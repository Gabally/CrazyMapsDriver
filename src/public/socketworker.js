let ws = null;

onmessage = (e) => {
  let { car, pos, connect } = e.data;
  if (connect) {
    ws = new WebSocket(connect);
    ws.addEventListener("open", (event) => {
      ws.addEventListener("message", (event) => {
        postMessage(event.data);
      });
    });
  } else {
    ws.send(`${car.xVelocity}|
      ${car.yVelocity}|
      ${car.power}|
      ${car.reverse}|
      ${car.angle}|
      ${car.angularVelocity}|
      ${pos.x}|
      ${pos.y}`);
  }
}
