const socket = io();
    const username = prompt("Enter your name:") || "Anonymous";

    socket.emit('user_connected', username);

    socket.on('active_users', (users) => {
      const list = document.getElementById('user-list');
      list.innerHTML = users.map(u => `<li>${u}</li>`).join('');
    });

    socket.on('receive_message', (data) => {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message';
      msgDiv.innerHTML = `
        <div class="sender">${data.sender}</div>
        <div>${data.text} <span class="time">${data.time}</span></div>
      `;
      document.getElementById('messages').appendChild(msgDiv);
      document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
    });

    function sendMessage(e) {
      e.preventDefault();
      const input = document.getElementById('message-input');
      socket.emit('send_message', { text: input.value });
      input.value = '';
    }