var socket = new WebSocket("ws://localhost:8080");
var state = "init_wait";
var player = -1;
var currentPlayer = -1;
var balances = [3,3,3,3];
var influences = [2,2,2,2];
var activePlayers = 4;
var cards = -1;
var block_toggle = true;
var success = false;
function setText(where,what) {
  document.getElementById(where).innerText = what;
}
function setHtml(where,what) {
  document.getElementById(where).innerHTML = what;
}
String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
}
function setChoices(array,nextState) {
  var html = "";
  for(var i in array) {
    html += "<div onclick=\"resetChoices();state='"+nextState+"';" + array[i][0] + "\">" + array[i][1] + "</div>";
  }
  setHtml("choices",html);
}
function resetChoices() {
  setText("choose_desc","");
  setText("choices","");
}
function updateStatus(player) {
  influences[player-1] = Math.max(0,influences[player-1]);
  setHtml("player"+player,"Player "+player+":<br/>Money: " + balances[player-1] +"<br/>Influence: " + influences[player-1]);
  if(influences[player-1] == 0) {
    setText("player"+player,"Player "+player+" is dead.");
    activePlayers--;
  }
}
function updateCards() {
  if(cards.length == 2) {
    setText("cards","Your cards: "+cards.join());
  } else {
    setText("cards","Your card is: "+cards[0]);
  }
}
function update(input_) {
  log(input_);
  var blocked = input_.split(";");
  if(input_.includes("challenge")) {
    var challengee;
    var challenger;
    if(blocked.length == 2) {
      challengee = parseInt(blocked[0].split(",")[1]);
      challenger = parseInt(blocked[1].split(",")[1]);
    } else {
      challengee = parseInt(blocked[1].split(",")[1]);
      challenger = parseInt(blocked[2].split(",")[1]);
    }
    if(input_.includes("won")) {
      influences[challengee-1] -= 1;
      updateStatus(challengee);
    } else if(input_.includes("lost")) {
      influences[challenger-1] -= 1;
      updateStatus(challenger);
    }
  }
  success = true;
  if(blocked.length == 2 && !input_.includes("lost") || blocked.length == 3 && !input_.includes("won")) {
    success = false;
    return;
  }
  var real = blocked[0];
  var input = real.split(",")[0];
  var player = real.split(",")[1];
  var target = real.split(",")[2];
  if(input == 'income') {
    balances[player-1] += 1;
    updateStatus(player);
  } else if(input == 'aid') {
    balances[player-1] += 2;
    updateStatus(player);
  } else if(input == 'tax') {
    balances[player-1] += 3;
    updateStatus(player);
  } else if(input == "coup") {
    balances[player-1] -= 7;
    influences[target-1] -= 1;
    updateStatus(target);
    updateStatus(player);
  } else if(input == "kill") {
    balances[player-1] -= 3;
    influences[target-1] -= 1;
    updateStatus(target);
    updateStatus(player);
  } else if(input == "steal") {
    var amount = Math.min(balances[target-1],2);
    balances[target-1] -= amount;
    balances[player-1] += amount;
    updateStatus(target);
    updateStatus(player);
  }
}
function playername(id) {
  if(player == id) {
    return "you";
  } else {
    return "player "+id;
  }
}
function _pretty(message) {
  var action = message.split(",")[0];
  var id = message.split(",")[1];
  var target = message.split(",")[2];
  if(action == "income") {
    return playername(id).capitalize() + " collected income";
  } else if(action == "aid") {
    return playername(id).capitalize() + " collected aid";
  } else if(action == "tax") {
    return playername(id).capitalize() + " collected taxes";
  } else if(action == "coup") {
    return playername(id).capitalize() + " started a coup against " + playername(target);
  } else if(action == "kill") {
    return playername(id).capitalize() + " assassinated " + playername(target);
  } else if(action == "steal") {
    return playername(id).capitalize() + " stole from " + playername(target);
  } else if(action == "exchange") {
    return playername(id).capitalize() + " exchanged cards";
  }
}
function pretty(input) {
  var text = _pretty(input.split(";")[0]);
  if(input.split(";")[1] != undefined) {
    var block = input.split(";")[1].split(",");
    var blocker = block[1];
    text += ", and " + playername(blocker).capitalize() + (block[0] == "block" ? " blocked " : " challenged ") + "them";
    if(block[0] == "challenge") {
      if(block[2] == "won") {
        text += ", and won";
      } else {
        text += ", and lost";
      }
    }
  }
  if(input.split(";")[2] != undefined) {
    var block = input.split(";")[2].split(",")
    var challenger = block[1];
    text += ", but " + playername(challenger).capitalize() + " challenged them";
    if(block[2] == "won") {
      text += ", and won";
    } else {
      text += ", and lost";
    }
  }
  return text;
}
function log(input) {
  document.getElementById('history').innerHTML += pretty(input) + '.<br>';
}
function chooseAction() {
  state = "choosing";
  setText("choose_desc","Choose an action!");
  var options = [["socket.send('income,'+player);","Take Income"],
                 ["socket.send('aid,'+player);","Foreign Aid"],
                 ["socket.send('tax,'+player);","Collect Tax"],
                 ["choosePlayer('steal');","Steal"],
                 ["socket.send('exchange,'+player);","Exchange cards"]];
  options.push(balances[player-1] >= 7 ? ["choosePlayer('coup');","Launch Coup"] : ["chooseAction();","<s>Launch Coup</s> (insufficent funds)"]);
  options.push(balances[player-1] >= 3 ? ["choosePlayer('kill');","Assassinate"] : ["chooseAction();","<s>Assassinate</s> (insufficent funds)"]);
  setChoices(options,'wait_reaction');
}
function choosePlayer(why) {
  state = "choosing";
  setText("choose_desc","Choose a target!");
  var options = [["chooseAction();","Back"]];
  for(var i = 0; i < 4;i++) {
    if(i == player-1) continue;
    if(influences[i] == 0) continue;
    options[i+1] = ["socket.send('"+why+",'+player+','+"+(i+1)+");","Player " + (i+1)];
  }
  setChoices(options,'wait_reaction');
}
socket.onmessage = function(event) {
  console.log("got " + event.data + " and state = " + state);
  if(state == "init_wait") {
    for(var i = 1; i <= 4; i++) {
      updateStatus(i);
    }
    var info = event.data.split(",");
    player = parseInt(info[0]);
    cards = [info[1],info[2]];
    document.getElementById("player"+player).style.backgroundColor = "red";
    updateCards();
    state = "turn_wait";
  } else if(state == "turn_wait") {
    currentPlayer = parseInt(event.data);
    if(currentPlayer == player) {
      setText("status","It is your turn!");
      chooseAction();
    } else {
      setText("status","It is player " + currentPlayer + "'s turn.");
      state = "wait_move";
    }
  } else if(state == "wait_move") {
    var action = event.data.split(",")[0];
    var target = parseInt(event.data.split(",")[2]);
    if(action == "income" || action == "coup") {
      socket.send(event.data);
      state = "wait_reaction";
    } else {
      var choices = [["socket.send('"+event.data+"');","Allow"]];
      if(action != "aid") {
        choices.push(["socket.send('"+event.data+";challenge,'+player);","Challenge"])
      }
      if(action == "aid" || (action == "steal" && target == player) || (action == "kill" && target == player)) {
        choices.push(["socket.send('"+event.data+";block,'+player);","Claim to block"]);
      }
      setText("choose_desc","Choose a reaction to " + pretty(event.data) + ".");
      setChoices(choices,"wait_reaction");
      state = "choosing";
    }
  } else if(state == "wait_reaction") {
    if(event.data.includes("react")) {
      var ed = event.data.split(";")[0] + ";" + event.data.split(";")[1];
      console.log("Now it is " + ed);
      block_toggle = false;
      var choices = [["socket.send('"+ed+"');","Allow"],["socket.send('"+ed+";challenge,'+player);","Challenge"]];
      setText("choose_desc","Choose a reaction to " + pretty(ed) + ".");
      setChoices(choices,"wait_reaction");
      state = "choosing";
    } else {
      var blocked = !block_toggle;
      block_toggle = true;
      var inf_old = influences[player-1];
      update(event.data); //sets 'success' and 'exchange'
      if(activePlayers == 1) {
        if(influences[player-1]) {
          state = "won";
          setText("status","You won!");
        }
      }
      state = "turn_wait";
      if(inf_old != influences[player-1]) {
        if(influences[player-1]) {
          state = "choosing";
          setText("choose_desc","Choose an influence to lose.");
          setChoices([["socket.send(cards[0]);cards.splice(0,1);updateCards();","Lose your " + cards[0]],["socket.send(cards[1]);cards.splice(1,1);updateCards();","Lose your " + cards[1]]],"turn_wait");
        } else {
          state = "dead";
          setText("status","You are dead.");
        }
      }
      if(success && event.data.includes("exchange") && parseInt(event.data.split(";")[0].split(",")[1]) == player) {
        state = "wait_exchange";
      }
    }
  } else if(state == "wait_exchange") {
    cards = cards.concat(event.data.split(","));
    exchangeCards(0);
    state = "choosing";
  }
}
var cardsChosen = [];
function exchangeCards(chosen) {
  if(chosen == 2) {
    socket.send(cards[cardsChosen[0]]+","+cards[cardsChosen[1]]);
    var cards2 = [];
    for(var i in cards) {
      if(i != cardsChosen[0] && i != cardsChosen[1]) {
        cards2.push(cards[i]);
      }
    }
    cards = cards2;
    updateCards();
    state = "turn_wait";
  } else {
    setText("choose_desc","Choose cards to return.");
    var options = chosen == 1 ? [["exchangeCards("+(chosen-1)+");","Back"]] : [];
    for(var i in cards) {
      if(i == cardsChosen[0] && chosen == 1) continue;
      options.push(["cardsChosen["+chosen+"]="+i+";exchangeCards("+(chosen+1)+");",cards[i].capitalize()]);
    }
    setChoices(options,"choosing");
  }
}
