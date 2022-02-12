onmessage = (e) => {
  this.ws = new WebSocket(
    `${window.location.protocol === "http:" ? "ws" : "wss"}://${
      window.location.host
    }`
  );
  this.ws.addEventListener("message", (event) => {
    try {
      if (event.data.startsWith("!")) {
        let command = event.data.substring(1);
        let [username, id] = command.split("|");
        this.netPlayers[id] = username;
      } else if (event.data.startsWith("#")) {
        let pid = event.data.substring(1);
        delete this.netPlayers[pid];
        delete this.netCars[pid];
      } else {
        let pkt = event.data.split("|").map((e) => parseFloat(e));
        if (this.netCars[pkt[0]]) {
          pkt[1] =
            this.netCars[pkt[0]][1] + (pkt[1] - this.netCars[pkt[0]][1]) * 0.4;
          pkt[2] =
            this.netCars[pkt[0]][2] + (pkt[2] - this.netCars[pkt[0]][2]) * 0.4;
        }
        this.netCars[pkt[0]] = pkt;
      }
    } catch (error) {
      console.error("Bogus data received from other client");
      console.error(error);
    }
  });
  this.ws.addEventListener("open", (event) => {
    resolve();
  });
  this.ws.addEventListener("error", () => {
    reject();
  });
  console.log("Message received from main script");
  var workerResult = "Result: " + e.data[0] * e.data[1];
  console.log("Posting message back to main script");
  postMessage(workerResult);
};
