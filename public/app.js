let ws;
let peerConnection;
let dataChannel;
let isCaller = false;

function login() {
    const username = document.getElementById("usernameInput").value;
    if (!username) return;

    ws = new WebSocket("ws://" + location.host);
    ws.onopen = () => {
        ws.send(JSON.stringify({ type: "login", name: username }));
    };

    ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        switch (data.type) {
            case "userlist":
                updateUsers(data.users, username);
                break;
            case "offer":
                handleIncomingCall(data);
                break;
            case "answer":
                peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                break;
            case "candidate":
                peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                break;
            case "leave":
                endCall();
                break;
        }
    };

    document.getElementById("app").style.display = "block";
}

function updateUsers(users, currentUser) {
    const ul = document.getElementById("users");
    ul.innerHTML = "";
    users.filter(u => u !== currentUser).forEach(user => {
        const li = document.createElement("li");
        li.textContent = user;
        li.onclick = () => startCall(user);
        ul.appendChild(li);
    });
}

async function startCall(target) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = stream;

    const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    peerConnection = new RTCPeerConnection(config);
    isCaller = true;
    dataChannel = peerConnection.createDataChannel("chat");
    setupDataChannelEvents(dataChannel);

    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate, target }));
        }
    };

    peerConnection.ontrack = ({ streams: [stream] }) => {
        document.getElementById("remoteVideo").srcObject = stream;
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", offer, target }));
}

function handleIncomingCall(data) {
    const accept = confirm(`Accepter l'appel de ${data.name} ?`);
    if (!accept) return;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(async (stream) => {
        document.getElementById("localVideo").srcObject = stream;

        const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
        peerConnection = new RTCPeerConnection(config);

        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannelEvents(dataChannel);
        };

        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate, target: data.name }));
            }
        };

        peerConnection.ontrack = ({ streams: [stream] }) => {
            document.getElementById("remoteVideo").srcObject = stream;
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", answer, target: data.name }));
    });
}

function setupDataChannelEvents(channel) {
    channel.onmessage = (event) => {
        displayMessage({ from: "remote", text: event.data });
    };
}

function displayMessage({ from, text }) {
    const messageItem = document.createElement("div");

    messageItem.style.alignSelf = from === "remote" ? "self-start" : "self-end";
    messageItem.style.backgroundColor = from === "remote" ? "whitesmoke" : "blue";
    messageItem.style.color = from === "remote" ? "black" : "white";
    messageItem.style.padding = "5px";
    messageItem.style.margin = "5px";
    messageItem.style.borderRadius = "10px";
    messageItem.textContent = text;

    document.getElementById("messages").appendChild(messageItem);
}

document.getElementById("chatForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const input = document.getElementById("chatInput");
    const message = input.value;
    input.value = "";
    if (dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(message);
        displayMessage({ from: "me", text: message });
    }
});
