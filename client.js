const signalingEndpoint = "wss://webrtc-signaling-demo.aerodigitale.fr:4040/ws"

document.addEventListener("DOMContentLoaded", (e) => {
  const roomInput = document.getElementById("room")

  roomInput.addEventListener("keydown", (e) => {
    if(e.keyCode == "13"){
      connect();
      e.preventDefault();
      return
    }
    if(e.currentTarget.value != "")
      document.getElementById("connect_btn").removeAttribute("disabled")
  })
})




function connect(){

  const connection = setupRTCConnection();
  if(!connection) return
  const room = document.getElementById("room").value
  document.getElementById("room").setAttribute("disabled", "disabled")
  document.getElementById("connect_btn").setAttribute("disabled", "disabled")

  setupSignalingSocket(connection, room)

}

function setupRTCConnection(){
  const connection = new RTCPeerConnection({
    "iceServers": [
      { "url": "stun:coturn.aerodigitale.fr" },
      { url: 'turn:coturn.aerodigitale.fr?transport=tcp',
        username: 'guest',
        credential: 'password',
      }
    ]
  });
  return connection
}

function setupSignalingSocket(connection, room){
  const wsUri = `${signalingEndpoint}/${room}`
  const socket = new WebSocket(wsUri)
  socket.onclose = () => setupSignalingSocket(connection, room)
  setupSocketListeners(socket, connection);
  return socket;
}

function retrievePairsInfo(socket){
  socket.send(JSON.stringify("getPairsInfo"))
}

function setupChannel(channel){
  channel.onmessage = (event) => alert(`Message reçu : ${event.data}`)
  channel.onopen = () => { console.debug("canal ouvert")
    document.getElementById("send_btn").removeAttribute("disabled")
  }
}

function setupSocketListeners(socket, connection){
  connection.onicecandidate = function(event){
    if(!event.candidate)
      return
    console.debug("-> sending ice candidate")
    socket.send(JSON.stringify({"iceCandidate": event.candidate}))
  }
  socket.onopen = () => retrievePairsInfo(socket)
  socket.onmessage = function(message){
    let data = JSON.parse(message.data)
    console.debug(data)
    let trigger = data["trigger"];
    switch(trigger){
      case "answerSdpOffer":
        console.debug("<- received offer")
        if(connection.remoteDescription){
          console.debug("ignoring")
          break;
        }

        let offer =  data["payload"]
        connection.setRemoteDescription(new RTCSessionDescription(offer))
        connection.createAnswer().then(desc => {
          connection.setLocalDescription(desc)
          console.debug("-> sending answer")
          socket.send(JSON.stringify({"answer": desc}))
          connection.ondatachannel = () => {
            channel = event.channel
            setupChannel(channel) }
        })

        break;
      case "addSdpAnswer":
        console.debug("<- received answer")
        if(connection.remoteDescription){
          console.debug("ignoring")
          break;
        }
        const answer = data["payload"]
        connection.setRemoteDescription(new RTCSessionDescription(answer))
        break;

      case "addIceCandidate":
        console.debug("<- received ice candidate")
        let remoteCandidate = data["payload"]
        connection.addIceCandidate(new RTCIceCandidate(remoteCandidate))
        break;

      case "createOffer":
        console.debug("<- received offer creation trigger")
        if(connection.localDecription){
          console.debug("ignoring")
          break;
        }
        channel = connection.createDataChannel('monCanal', null)
        setupChannel(channel);
        connection.createOffer().then((desc) => {
          connection.setLocalDescription(desc)
          negotiating = false
          console.debug("-> sending offer")
          socket.send(JSON.stringify({"offer": desc}))
        });
    }
  }
}

function send(){
  let message = prompt("Tapez un message");
  channel.send(message)
}

