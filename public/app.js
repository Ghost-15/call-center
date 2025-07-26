let ws;
let username;
let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function connect() {
    username = document.getElementById('usernameInput').value.trim();
    if (!username) return alert("Nom requis");

    ws = new WebSocket(`ws://${location.host}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'login', username }));
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'login':
                if (data.success) {
                    document.getElementById('userListContainer').style.display = 'block';
                    updateUserList(data.users);
                } else {
                    alert(data.message || "Nom déjà utilisé");
                }
                break;
            case 'new-user':
                addUserToList(data.username);
                break;
            case 'user-disconnected':
                removeUserFromList(data.username);
                break;
            case 'call':
                handleIncomingCall(data);
                break;
            case 'answer':
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                break;
            case 'reject':
                alert(`${data.from} a rejeté l’appel.`);
                break;
            case 'ice-candidate':
                if (peerConnection) {
                    try {
                        await peerConnection.addIceCandidate(data.candidate);
                    } catch (e) {
                        console.error('Erreur ICE', e);
                    }
                }
                break;
        }
    };
}

function updateUserList(users) {
    const list = document.getElementById('userList');
    list.innerHTML = '';
    users.forEach(addUserToList);
}

function addUserToList(name) {
    const li = document.createElement('li');
    li.id = name;

    const span = document.createElement('span');
    span.textContent = name;

    const btn = document.createElement('button');
    btn.textContent = "Appeler";
    btn.onclick = () => startCall(name);

    li.appendChild(span);
    li.appendChild(document.createTextNode(" "));
    li.appendChild(btn);
    document.getElementById('userList').appendChild(li);
}

function removeUserFromList(name) {
    const li = document.getElementById(name);
    if (li) li.remove();
}

async function setupLocalStream() {
    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
    }
}

async function startCall(toUsername) {
    await setupLocalStream();

    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            ws.send(JSON.stringify({ type: "ice-candidate", to: toUsername, candidate }));
        }
    };

    peerConnection.ontrack = ({ streams: [stream] }) => {
        document.getElementById('remoteVideo').srcObject = stream;
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    ws.send(JSON.stringify({ type: 'call', to: toUsername, offer }));
}

async function handleIncomingCall(data) {
    const accept = confirm(`${data.from} t'appelle. Accepter ?`);

    if (!accept) {
        ws.send(JSON.stringify({ type: 'reject', to: data.from }));
        return;
    }

    await setupLocalStream();

    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            ws.send(JSON.stringify({ type: "ice-candidate", to: data.from, candidate }));
        }
    };

    peerConnection.ontrack = ({ streams: [stream] }) => {
        document.getElementById('remoteVideo').srcObject = stream;
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    ws.send(JSON.stringify({ type: 'answer', to: data.from, answer }));
}
