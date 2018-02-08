// base03    #002b36
// base02    #073642
// base01    #586e75
// base00    #657b83
// base0     #839496
// base1     #93a1a1
// base2     #eee8d5
// base3     #fdf6e3
// yellow    #b58900
// orange    #cb4b16
// red       #dc322f
// magenta   #d33682
// violet    #6c71c4
// blue      #268bd2
// cyan      #2aa198
// green     #859900

var colors = ['#fdf6e3', '#cb4b16', '#268bd2', '#eee8d5'];
var canvas, ctx;
var gridColor = '#eee8d5';
var gridSize = 50;
var gridThickness = 4;
var zoom = {
  scale: 1,
  speed: 1.1,
  range: {
    min: 0.1,
    max: 5
  },
  screen: {
    x: 0,
    y: 0
  },
  world: {
    x: 0,
    y: 0
  }
};
var pressTimer;
var clicked = false;
var drag = false;
var dragStep = 50;
var players = [0, 0];
var moves = [];
var originalMousePosition;

var scale = {
  length: function (number) {
    return (number * zoom.scale);
  },
  x: function (number) {
    return ((number - zoom.world.x) * zoom.scale + zoom.screen.x);
  },
  y: function (number) {
    return ((number - zoom.world.y) * zoom.scale + zoom.screen.y);
  },
  x_INV: function (number) {
    return ((number - zoom.screen.x) / zoom.scale + zoom.world.x);
  },
  y_INV: function (number) {
    return ((number - zoom.screen.y) / zoom.scale + zoom.world.y);
  }
};

function getMouseOffset (event) {
  var offset = [event.offsetX || event.pageX - $(event.target).offset().left,
                event.offsetY || event.pageY - $(event.target).offset().top];
  return offset;
}

function update (mn = moves.length) {
  $.getJSON($SCRIPT_ROOT + '/_update', {move_number: mn},
    function (data) {
      if (data.move_number === moves.length) { // we have all moves
        if (data.moves.length > 0) {
          if (data.moves.length === moves.length) {
            console.log('Syncing ...');
            syncMoves(data.moves);
          } else {
            console.log('Error, data not full', data, moves);
          }
        }
      } else if (data.move_number === (moves.length + data.moves.length)) {
        for (var i = 0; i < data.moves.length; i++) {
          fillSquare(data.moves[i][0], data.moves[i][1],
                     colors[data.moves[i][2]]);
        }
        moves = moves.concat(data.moves);
        updateTurn(data.moves[data.moves.length - 1][2]);
      } else {
        console.log('Error, too much data', data, moves);
      }
      if (data.players[0] !== players[0] ||
          data.players[1] !== players[1]) {
        console.log(players);
        updatePlayers(data.players);
      }
    }
  );
  return false;
}

function syncMoves (newMoves) {
  var sync = true;
  for (var i = 0; i < moves.length; i++) {
    for (var j = 0; j < moves[i].length; j++) {
      if (moves[i][j] !== newMoves[i][j]) {
        console.log('out of sync:', i, moves[i], newMoves[i]);
        moves[i][j] = newMoves[i][j];
        sync = false;
      }
    }
  }
  if (!sync) {
    redrawCanvas();
  }
}

function updatePlayers (newPlayers) {
  players = newPlayers;
  $('#user1').html(players[0]);
  $('#user2').html(players[1]);
}

function updateTurn (value) {
  var other = value === 1 ? 2 : 1;
  $('#user' + value).css('background-color', colors[0]);
  $('#user' + other).css('background-color', colors[other]);
}

function ping () { // never used
  $('#foo').bind('click', function () {
    $.getJSON($SCRIPT_ROOT + '/ping', {},
      function (data) {
        $('#result').text(data.answer);
      }
    );
    return false;
  });
}

function clear () {
  $.getJSON($SCRIPT_ROOT + '/_clear', {},
    function (date) {
      moves = [];
      drawGrid();
    }
  );
}

function setUser (value) {
  $.getJSON($SCRIPT_ROOT + '/_set_user', {value: value},
    function (data) {
      if (data.value === value) {
        window.alert('Role is set');
      }
    }
  );
}

function setUsername (value) {
  var username = $('#username').val();
  $.getJSON($SCRIPT_ROOT + '/_set_username', {username: username});
}

function drawGrid () {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  for (var x = scale.x(0) % scale.length(gridSize);
       x < canvas.width; x += scale.length(gridSize)) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (var y = scale.y(0) % scale.length(gridSize);
       y < canvas.height; y += scale.length(gridSize)) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = scale.length(gridThickness);
  ctx.stroke();
}

function drawMoves () {
  for (var i = 0; i < moves.length; i++) {
    fillSquare(moves[i][0], moves[i][1], colors[moves[i][2]]);
  }
}

function fillSquare (x, y, color) {
  // fill rectangle with player color
  // change to X O if needed
  ctx.fillStyle = color;
  ctx.fillRect(scale.x(x * gridSize) + scale.length(gridThickness / 2),
               scale.y(y * gridSize) + scale.length(gridThickness / 2),
               scale.length(gridSize - gridThickness),
               scale.length(gridSize - gridThickness));
}

function setMove (x, y) {
  $.getJSON(
    $SCRIPT_ROOT + '/_move', { x: x, y: y },
    function (data) {
      if (data.count !== 0) {
        update();
      }
    }
  );
}

function fitToContainer () {
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

function getCellByPos (pos) {
  var cell = [Math.floor(scale.x_INV(pos[0]) / gridSize),
              Math.floor(scale.y_INV(pos[1]) / gridSize)];
  return cell;
}

function canvasOnMouseMove (evt) {
  if (drag) {
    var mousePosition = getMouseOffset(evt);
    var offset = [mousePosition[0] - originalMousePosition[0],
                  mousePosition[1] - originalMousePosition[1]];
    if (offset[0] ** 2 + offset[1] ** 2 > dragStep ** 2) {
      zoom.screen.x += offset[0];
      zoom.screen.y += offset[1];
      originalMousePosition = mousePosition;
      redrawCanvas();
    }
  }
  evt.preventDefault();
  return false;
}

function canvasOnMouseDown (evt) {
  if (clicked) {
    clicked = false;
    drag = false;
  } else if (drag) {
    drag = false;
  } else {
    clicked = true;
    originalMousePosition = getMouseOffset(evt);
    pressTimer = setTimeout(function () {
      clicked = false;
      drag = true;
      evt.target.style.cursor = 'move';
    }, 300);
  }
  evt.preventDefault();
  return false;
}

function canvasOnMouseUp (evt) {
  var mousePosition = getMouseOffset(evt);
  var originalCell = getCellByPos(originalMousePosition);
  drag = false;
  evt.target.style.cursor = 'auto';
  clearTimeout(pressTimer);
  var cell = getCellByPos(mousePosition);
  if ((clicked) &&
      (originalCell[0] === cell[0]) && (originalCell[1] === cell[1])) {
    clicked = false;
    setMove(cell[0], cell[1]);
  }
  evt.preventDefault();
  return false;
}

function canvasOnMouseWheel (evt) {
  // Do nothing if already zoomed to max\min
  if (((evt.deltaY < 0) && (zoom.scale === zoom.range.max)) ||
      ((evt.deltaY > 0) && (zoom.scale === zoom.range.min))) {
    evt.preventDefault();
    return false;
  }
  var mousePosition = getMouseOffset(evt);
  var dx = scale.x_INV(mousePosition[0]);
  var dy = scale.y_INV(mousePosition[1]);
  if (evt.deltaY < 0) {
    zoom.scale = Math.min(zoom.range.max, zoom.scale * zoom.speed);
  } else {
    zoom.scale = Math.max(zoom.range.min, zoom.scale / zoom.speed);
  }
  document.getElementById('zoomLevel').innerHTML = zoom.scale.toFixed(2);
  zoom.screen.x = mousePosition[0];
  zoom.screen.y = mousePosition[1];
  zoom.world.x = dx;
  zoom.world.y = dy;
  redrawCanvas();
  evt.preventDefault();
  return false;
}

function resetScale () {
  zoom.screen.x = 0;
  zoom.screen.y = 0;
  zoom.world.x = 0;
  zoom.world.y = 0;
  zoom.scale = 1;
  document.getElementById('zoomLevel').innerHTML = 1;
  redrawCanvas();
}

function InitCanvas () {
  canvas = document.getElementById('gamefield');
  canvas.addEventListener('mousemove', canvasOnMouseMove, false);
  canvas.addEventListener('mousedown', canvasOnMouseDown, false);
  canvas.addEventListener('mouseup', canvasOnMouseUp, false);
  canvas.addEventListener('wheel', canvasOnMouseWheel, false);
  ctx = canvas.getContext('2d');
  resizeCanvas();
  loop();
}

function redrawCanvas () {
  drawGrid();
  update(0);
  drawMoves();
}

function resizeCanvas () {
  fitToContainer();
  redrawCanvas();
}

function loop () {
  update();
  setTimeout(loop, 1000);
}

window.addEventListener('onresize', resizeCanvas, false);

$(function tictac () {
  InitCanvas();
});

// clear game board by clicling the button
$('#clear').click(clear);
$('#refresh').click(function () { update(0) });
$('#setUsername').click(function () { setUsername() });
$('#bex').click(function () { setUser('0') });
$('#beo').click(function () { setUser('1') });
$('#resetScale').click(resetScale);
