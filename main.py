import subprocess
import os
import websockets
import asyncio
import random
os.chdir("site")
pid = subprocess.Popen(["/usr/bin/python3","-m","http.server","8000"])
users = 0
alivePlayers = 4
activeUser = 1
ready = 0
move = ""
reaction = ""
reaction2 = ""
nreactions = 0
deck = ["assassin"]*3 + ["duke"]*3 + ["captain"]*3 + ["ambassador"]*3 + ["contessa"]*3
discard = []
random.shuffle(deck)
def draw():
    global deck,discard
    if(len(deck) == 0):
        deck = discard
        random.shuffle(deck)
    result = deck.pop()
    return result
cards = [["null","null"],["null","null"],["null","null"],["null","null"]]

CARD_NEEDED_TABLE = {
        'steal':'captian',
        'kill':'assassin',
        'exchange':'ambassador',
        'tax':'duke'
    }

BLOCK_NEEDED_TABLE = {
        'steal': ['captian','ambassador'],
        'kill': ['contessa'],
        'aid': ['duke']
    }

async def open_socket(websocket,path):
    global users,activeUser,cards,alivePlayers,deck,discard,move,reaction,reaction2
    async def send(x):
        await websocket.send(x)
        print(f"{user}: sent {x}")
    async def recv():
        x = await websocket.recv()
        print(f"{user}: got {x}")
        return x
    async def delay():
        await asyncio.sleep(0.1)
    async def sync():
        global ready
        ready += 1
        while ready != alivePlayers: await delay()
        await delay()
        if ready == alivePlayers: ready = 0
    async def loseCards(delta):
        global discard,alivePlayers
        len_new = len(cards[user-1]) - delta
        if delta == 1 and len_new == 1:
            choice = await recv()
            cards[user-1].remove(choice)
            discard.append(choice)
        elif len_new == 0:
            discard += cards[user-1]
            cards[user-1] = []
            alivePlayers -= 1
            print(f"Killed connection to client {user} (they lost)")
            return True
        return False
    if users == 4: return #only accept four clients
    try:
        users += 1
        user = users
        print(f"Opened client {users}")
        cards[user-1][0] = draw()
        cards[user-1][1] = draw()
        await sync()
        await send(str(user) + "," + ",".join(cards[user-1]))
        while True:
            await sync()
            await send(str(activeUser))
            move = ""
            if user == activeUser:
                move = await recv()
                reaction = ""
                reaction2 = ""
                await sync()
                await sync()
                if "challenge" in reaction:
                    liar = True
                    for i in cards[user-1]:
                        if i == CARD_NEEDED_TABLE[reaction.split(",")[0]]:
                            liar = False
                    if liar:
                        reaction += ",won"
                    else:
                        reaction += ",lost"
                if "block" in reaction:
                    await send(reaction+";react")
                    x = await recv()
                    reaction2 = reaction2 or x
                    if reaction2 == reaction and x != reaction:
                        reaction2 = x
                    if "challenge" in reaction2:
                        liar = True
                        for i in cards[int(reaction2.split(";")[1].split(",")[1])-1]:
                            print(i)
                            if i in BLOCK_NEEDED_TABLE[reaction.split(",")[0]]:
                                liar = False
                        if liar:
                            reaction2 += ",won"
                        else:
                            reaction2 += ",lost"
                await sync()
                await send(reaction2 or reaction)
                delta = 0
                success = False
                if not reaction2:
                    if "won" in reaction:
                        delta = 1
                    success = ";" not in move or "lost" in move
                else:
                    if "lost" in reaction2 and reaction2.split(";")[2].split(",")[1] == user:
                        delta = 1
                    success = "won" in move
                lost = await loseCards(delta)
                if lost: break
                if success and "exchange" in move:
                    draws = [draw(),draw()]
                    await send(",".join(draws))
                    discards = await recv()
                    discards = discards.split(",")
                    discard += discards
                    cards[user-1] += draws
                    for i in discards:
                        cards[user-1].remove(i)

                await sync()
                if alivePlayers == 1:
                    print(f"Killed connection to client {user} (they won)")
                    break
                while activeUser == user or len(cards[activeUser-1]) == 0:
                    activeUser += 1
                    if activeUser == 5: activeUser = 1
            else:
                await sync()
                await send(move)
                x = await recv()
                reaction = reaction or x
                if reaction == move and x != move:
                    reaction = x
                await sync()
                if "block" in reaction and int(reaction.split(";")[1].split(",")[1]) != user:
                        await send(reaction+";react")
                        x = await recv()
                        reaction2 = reaction2 or x
                        if reaction2 == reaction and x != reaction:
                            reaction = x
                await sync()
                await send(reaction2 or reaction)
                parts = reaction.split(";")[0].split(",")
                delta = 0
                if not reaction2:
                    delta = \
                        int((";" not in reaction or "lost" in reaction) and parts[0] in ("kill","coup") and int(parts[2]) == user) + \
                        int("lost" in reaction and int(reaction.split(";")[1].split(",")[1]) == user)
                else:
                    delta = \
                        int("won" in reaction2 and parts[0] in ("kill","coup") and int(parts[2]) == user) + \
                        int("won" in reaction2 and int(reaction2.split(";")[1].split(",")[1]) == user) + \
                        int("lost" in reaction2 and int(reaction2.split(";")[2].split(",")[1]) == user)
                lost = await loseCards(delta)
                if lost: break
                await sync()
                if alivePlayers == 1:
                    print(f"Killed connection to client {user} (they won)")
                    break
    except websockets.exceptions.ConnectionClosed:
        pass
    users -= 1
asyncio.get_event_loop().run_until_complete(websockets.serve(open_socket,"localhost",8080))
asyncio.get_event_loop().run_forever()
