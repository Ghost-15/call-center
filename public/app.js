let ws;
let username;
let peerConnection;
let dataChannel;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function connect() {
    username = document.getElementById('username').value;
    if (!username) return;

    ws = new WebSocket(`ws://${window.location.host}`);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'login', name: username }));
    ws.onmessage = handleMessage;
}

function handleMessage(msg) {
    const data = JSON.parse(msg.data);

    switch (data.type) {
        case 'login':
            if (data.success) updateUsers(data.users);
            else alert("Nom déjà utilisé.");
            break;
        case 'update-users':
            updateUsers(data.users);
            break;
        case 'call-request':
            if (confirm(`${data.from} veut vous appeler`)) {
                startCall(false);
                ws.send(JSON.stringify({ type: 'call-response', from: username, to: data.from, accept: true }));
            } else {
                ws.send(JSON.stringify({ type: 'call-response', from: username, to: data.from, accept: false }));
            }
            break;
        case 'call-response':
            if (data.accept) createOffer(data.from);
            else alert(`${data.from} a refusé l'appel`);
            break;
        case 'offer':
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            createAnswer(data.from);
            break;
        case 'answer':
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;
        case 'ice':
            peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            break;
    }
}

function updateUsers(users) {
    const list = document.getElementById('usersList');
    list.innerHTML = '';
    users.filter(u => u !== username).forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        li.onclick = () => callUser(user);
        list.appendChild(li);
    });
}

async function callUser(user) {
    startCall(true);
    ws.send(JSON.stringify({ type: 'call-request', from: username, to: user }));
}

async function startCall(isCaller) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = stream;

    peerConnection = new RTCPeerConnection(config);
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    peerConnection.ontrack = e => {
        document.getElementById('remoteVideo').srcObject = e.streams[0];
    };

    peerConnection.onicecandidate = e => {
        if (e.candidate) {
            ws.send(JSON.stringify({ type: 'ice', to: remoteUser, candidate: e.candidate }));
        }
    };

    peerConnection.ondatachannel = e => {
        dataChannel = e.channel;
        setupChat();
    };

    if (isCaller) {
        dataChannel = peerConnection.createDataChannel("chat");
        setupChat();
    }
}

let remoteUser = "";

async function createOffer(to) {
    remoteUser = to;
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', to, offer }));
}

async function createAnswer(to) {
    remoteUser = to;
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: 'answer', to, answer }));
}

function setupChat() {
    dataChannel.onmessage = e => {
        const msg = document.createElement("div");
        msg.textContent = "personne: " + e.data;
        document.getElementById("messages").appendChild(msg);
    };
    document.getElementById("chatForm").onsubmit = e => {
        e.preventDefault();
        const input = document.getElementById("chatInput");
        const msg = input.value;
        input.value = "";
        dataChannel.send(msg);
        const myMsg = document.createElement("div");
        myMsg.textContent = "Moi: " + msg;
        myMsg.style.color = "blue";
        document.getElementById("messages").appendChild(myMsg);
    };
}