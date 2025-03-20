import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";

const socket = io('https://paperback-quilt-led-stages.trycloudflare.com', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Socket conectado com ID:', socket.id);
});

function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedNumber, setSelectedNumber] = useState(null);
  const selectedNumberRef = useRef(selectedNumber);
  const [numbers, setNumbers] = useState([]);
  const [chatNames, setChatNames] = useState({});
  const [adminName, setAdminName] = useState('');
  const [usuarios, setUsuarios] = useState([])
  const [botEnabled, setBotEnabled] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [statusAtendimento, setStatusAtendimento] = useState({});
  const [dragging, setDragging] = useState(false);
  const [statusInfo, setStatusInfo] = useState({});
  const fileInputRef = useRef(null);
  const [editingChat, setEditingChat] = useState(null)
  
  const loadQuickReplies = () => {
    const storedReplies = JSON.parse(localStorage.getItem('quickReplies'));
    return storedReplies ? storedReplies : [
      "Olá! Como posso ajudar?",
      "Tudo bem, estamos trabalhando nisso!",
      "Por favor, aguarde um momento.",
      "Em breve entraremos em contato.",
      "Obrigado pelo seu contato!"
    ];
  };

  const [quickReplies, setQuickReplies] = useState(loadQuickReplies());

  const saveQuickReplies = (updatedReplies) => {
    localStorage.setItem('quickReplies', JSON.stringify(updatedReplies));
  };

  const handleAddQuickReply = (newReply) => {
    if (newReply.trim()) {
      const updatedReplies = [...quickReplies, newReply];
      setQuickReplies(updatedReplies);
      saveQuickReplies(updatedReplies);
    }
  };

  const handleRemoveQuickReply = (reply) => {
    const updatedReplies = quickReplies.filter(item => item !== reply);
    setQuickReplies(updatedReplies);
    saveQuickReplies(updatedReplies);
  };

  const handleQuickReply = (message) => {
    setNewMessage(message);
  };

  useEffect(() => {
    selectedNumberRef.current = selectedNumber; 
  }, [selectedNumber]);

  useEffect(() => {
    const handleDragOver = (event) => {
      event.preventDefault();
      setDragging(true);
    };
  
    const handleDragLeave = (event) => {
      event.preventDefault();
    };
  
    const handleDrop = (event) => {
      event.preventDefault();
      setDragging(false);
      
      if (event.dataTransfer.files.length > 0 && selectedNumberRef.current) {
        const file = event.dataTransfer.files[0];
        handleSendImage(file, selectedNumberRef.current);
      } else {
        alert("Selecione um chat antes de soltar uma imagem.");
      }
    };
  
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
  
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);
  
  useEffect(() => {
    if (usuarios.length > 0) {
      const newStatus = {};
      const msgStatus = {};
      
      usuarios.forEach(user => {
        newStatus[user.numero] = user.status.pendent ? "Atendimento pendente" : "Resolvido";
        msgStatus[user.numero] = user.status.waitingForInfo;
      });
  
      setStatusAtendimento(newStatus);
      setStatusInfo(msgStatus);
    }
  }, [usuarios]);

  const handleToggleBot = (number) => {
    const isEnabled = botEnabled[number] ?? false;
    
    setBotEnabled((prevState) => ({
      ...prevState,
      [number]: !isEnabled,
    }));
    
    socket.emit('toggleBot', {
      chatid: number,
      isBotEnabled: !isEnabled,
    });
    
    console.log(`Bot ${!isEnabled ? 'habilitado' : 'desabilitado'} para o chat ${number}`);
  };

  useEffect(() => {
    const savedChatNames = JSON.parse(localStorage.getItem("chatNames")) || {};
    setChatNames(savedChatNames);
  }, []);  

  useEffect(() => {
    socket.on('statusUpdated', (updatedStatus) => {
      setUsuarios(prevUsuarios => {
        return prevUsuarios.map(user => 
          user.numero === updatedStatus.numero 
            ? { ...user, status: updatedStatus.status } 
            : user
        );
      });
    });
  
    return () => {
      socket.off('statusUpdated');
    };
  }, []);  

  useEffect(() => {
    console.log('Conectando ao socket...');

    const fetchUsuarios = async () => {
      try {
        const response = await fetch('https://paperback-quilt-led-stages.trycloudflare.com/usuarios', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
    
        const data = await response.json();
        console.log("Dados recebidos:", data);
    
        return data.map(user => ({
          numero: user.usuario,
          status: user.dados
        }));
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        return [];
      }
    };
    
    (async () => {
      let usuariosData = await fetchUsuarios();
      setUsuarios(usuariosData);
    })();

    const fetchMessages = async () => {
    try {
      const response = await fetch('https://paperback-quilt-led-stages.trycloudflare.com/messages', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar as mensagens');
      }

      const data = await response.json();

      setMessages((prevMessages) => {
        const allMessages = [...prevMessages, ...data];

        return Array.from(new Map(allMessages.map((msg) => [msg.timestamp + msg.text, msg])).values());
      });

      const lastMessageTimes = {};
      data.forEach((msg) => {
        lastMessageTimes[msg.chatid] = Math.max(lastMessageTimes[msg.chatid] || 0, msg.timestamp);
      });

      const sortedNumbers = [...new Set(data.map((msg) => msg.chatid))].sort((a, b) => {
        return (lastMessageTimes[b] || 0) - (lastMessageTimes[a] || 0);
      });

      setNumbers(sortedNumbers);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

    socket.on('newMessage', (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
  
      setStatusInfo((prevState) => ({
        ...prevState,
        [message.chatid]: true, 
      }));
  
      setUnreadMessages((prevState) => ({
        ...prevState,
        [message.chatid]: true, 
      }));
  
      setUsuarios((prevUsuarios) => {
        const userExists = prevUsuarios.some(user => user.numero === message.chatid);
        if (!userExists) {
          return [...prevUsuarios, { numero: message.chatid, status: { pendent: true } }];
        }
        return prevUsuarios;
      });
  
      setStatusAtendimento((prevState) => {
        return {
          ...prevState,
          [message.chatid]: "Atendimento pendente",
        };
      });
    });

    const intervalId = setInterval(fetchMessages, 500);

    return () => {
      clearInterval(intervalId);
      socket.off('newMessage');
    };
  }, []);  

  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      try {
        const response = await fetch('https://paperback-quilt-led-stages.trycloudflare.com/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: newMessage,
            phoneNumber: selectedNumber,
            adminName,
          }),
        });

        if (response.ok) {
          setNewMessage('');
        } else {
          throw new Error('Erro ao enviar a mensagem');
        }
      } catch (error) {
        console.error('Erro:', error);
      }
    }
  };
  
  const handleSendImage = (file, number) => {
    if (!file) {
      alert("Nenhuma imagem selecionada.");
      return;
    }

    const formData = new FormData();
    formData.append("media", file);
    formData.append("content", newMessage);
    formData.append("phoneNumber", number);
    formData.append("adminName", adminName);

    fetch("https://paperback-quilt-led-stages.trycloudflare.com/reply", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Mensagem enviada com sucesso:", data);
      })
      .catch((error) => {
        console.error("Erro ao enviar mensagem:", error);
      });
  };

  const handleSetAdminName = (name) => {
    setAdminName(name);
    localStorage.setItem('adminName', name);
  };

  const handleToggleResolved = async (selectedNumber) => {
    try {
      const user = usuarios.find(user => user.numero === selectedNumber);
      
      if (!user) {
        console.error("Usuário não encontrado!");
        return;
      };
      
      const newPendentStatus = !user.status.pendent;
  
      const response = await fetch(`https://paperback-quilt-led-stages.trycloudflare.com/usuarios/toggle-pendent/${selectedNumber}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pendent: newPendentStatus }),
      });

      if (!response.ok) {
        throw new Error("Falha ao atualizar o status na API");
      }
  
      setUsuarios((prevUsuarios) => {
        return prevUsuarios.map(user => 
          user.numero === selectedNumber 
            ? { ...user, status: { ...user.status, pendent: newPendentStatus } }
            : user
        );
      });

      const newStatus = {};
      
      usuarios.forEach(user => {
        newStatus[user.numero] = user.status.pendent ? "Atendimento pendente" : "Resolvido";
      });
    
        setStatusAtendimento(newStatus);
        
        console.log("Status atualizado com sucesso!");
      } catch (error) {
        console.error("Erro ao tentar atualizar o status do usuário:", error);
      }
  };  

  const handleUploadImage = () => {
    fileInputRef.current.click();
  };

  const handleSelectNumber = (number) => {
    setSelectedNumber(number);
    
    setStatusInfo((prevState) => ({
      ...prevState,
      [number]: false, 
    }));
    
  };

  const handleSetChatName = (number, name) => {
    setChatNames((prevNames) => {
      const updatedNames = { ...prevNames, [number]: name };
      localStorage.setItem("chatNames", JSON.stringify(updatedNames));
      return updatedNames;
    });
  };  

  const handleEditChatName = (number) => {
    setEditingChat(number);
  };
  
  const handleChatNameChange = (event, number) => {
    handleSetChatName(number, event.target.value);
  };
  
  const handleBlurOrEnter = (event, number) => {
    if (event.key === "Enter" || event.type === "blur") {
      setEditingChat(null);
    }
  };  

  const filteredMessages = messages.filter(
    (message) =>
      message.chatid === selectedNumber || 
      message.sender === 'Bot' && message.chatid === selectedNumber || 
      (message.isAdminResponse && message.chatid === selectedNumber && message.sender !== 'Bot')
  );

  return (
    <div className="App" 
    style={{
      background: dragging ? "rgba(0,0,0,0.2)" : "white",
      transition: "background 0.3s ease",
      position: 'relative'
    }}>
      {dragging && (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: "24px",
        fontWeight: "bold",
        zIndex: 9999,
        pointerEvents: "none",
      }}>
        Solte a imagem para enviar (uma por vez)
      </div>
    )}
      <div className="sidebar">
        <img src='logo.png' alt='logo escola'/>
        <h3>Chats Colégio Líder:</h3>
        <ul>
          {numbers.map((number, index) => {
            const contact = messages.find((msg) => msg.chatid === number);
            const contactName = contact ? contact.sender : number;

            return (
              <li key={index} onClick={() => handleSelectNumber(number)} style={{ position: 'relative' }}>
                
                <div className='nomeChat'>
                  {chatNames[number] || contactName}
                  <span style={{backgroundColor: statusAtendimento[number] == "Atendimento pendente" ? '#C70039' : 'green'}}>
                    {statusAtendimento[number]}
                  </span>
                </div>

                {(statusAtendimento[number] == "Atendimento pendente" ? true : false) && (
                  <span 
                    style={{
                      backgroundColor: 'red',
                      color: 'white',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'inline-block',
                      textAlign: 'center',
                      fontSize: '12px',
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                    }}
                  >
                    !
                  </span>
                )}
                {statusInfo[number] && (
                    <span 
                      style={{
                        backgroundColor: '#4ceb34',
                        color: 'white',
                        borderRadius: '50%',
                        width: '16px',
                        height: '16px',
                        display: 'inline-block',
                        textAlign: 'center',
                        fontSize: '12px',
                        position: 'absolute',
                        top: '5px',
                        right: '25px',
                      }}
                    >
                    </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="chat-container">
      {selectedNumber ? (
        <>
          <div onClick={() => handleEditChatName(selectedNumber)} style={{ cursor: "pointer" }}>
            {editingChat === selectedNumber ? (
              <input
                type="text"
                value={chatNames[selectedNumber] || selectedNumber}
                onChange={(e) => handleChatNameChange(e, selectedNumber)}
                onKeyDown={(e) => handleBlurOrEnter(e, selectedNumber)}
                onBlur={(e) => handleBlurOrEnter(e, selectedNumber)}
                autoFocus
              />
            ) : (
              <h1>{chatNames[selectedNumber] || selectedNumber}</h1>
            )}
          </div>

          <div>
            <input
              type="text"
              value={adminName || ''}
              onChange={(e) => handleSetAdminName(e.target.value)}
              placeholder="Digite seu nome, Admin"
            />
          </div>

          <div className='botoes'>
            <button
              className="toggle-bot-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleBot(selectedNumber);
              }}
            >
              {botEnabled[selectedNumber] ? 'Desabilitar Bot' : 'Habilitar Bot'}
            </button>

            <button
              className="toggle-bot-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleResolved(selectedNumber);
              }}
            >
              {usuarios.length > 0 && usuarios.some(user => user.numero === selectedNumber) ? (
                usuarios.find(user => user.numero === selectedNumber).status.pendent
                  ? 'Marcar como resolvido'
                  : 'Marcar como atendimento pendente'
              ) : (
                'Usuário não encontrado'
              )}
            </button>
          </div>

          <div className="messages">
            {filteredMessages
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
              .map((message, index) => (
                <div
                  key={index}
                  className={
                    message.isAdminResponse
                      ? 'admin'
                      : message.sender === 'Bot'
                      ? 'bot'
                      : 'user'
                  }
                >
                  <strong>
                  {message.isAdminResponse ? `${adminName || 'Colégio Líder'}` : message.sender}:
                  </strong>
                  {message.text}
                  {message.media && (
                    <div
                      style={{
                        boxShadow: 'none',
                        padding: 0
                      }}
                    >
                      <img 
                        src={`data:image/jpeg;base64,${message.media.data}`} 
                        alt="Mídia enviada" 
                        style={{ maxWidth: '100%', maxHeight: 'auto' }} 
                      />
                    </div>
                  )}
                  <div
                    className="timestamp"
                    style={{ textAlign: message.isAdminResponse ? 'right' : 'left' }}
                  >
                    <small>{new Date(message.timestamp).toLocaleString()}</small>
                  </div>
                </div>
              ))}
          </div>

          <div className='botoes' style={{gap: 2 + 'px'}}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
              placeholder="Digite uma resposta"
            />
            <button className='botaoResponder' onClick={handleSendMessage}><FontAwesomeIcon icon={faPaperPlane} /></button>
          </div>

          <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              ref={fileInputRef}
              onChange={(e) => handleSendImage(e.target.files[0], selectedNumber)}
          />

          <button onClick={handleUploadImage} style={{ cursor: 'pointer' }}>
            Enviar Imagem
          </button>
        </>
      ) : (
        <h1>Selecione um número para ver as mensagens</h1>
      )}
      </div>
      <div className="quickReplies">
          <h4>Mensagens rápidas:</h4>
          <div className="quickRepliesContainer">
            {quickReplies.map((reply, index) => (
              <div key={index} className="quickReplyItem">
                <button onClick={() => handleQuickReply(reply)}>{reply}</button>
                <button onClick={() => handleRemoveQuickReply(reply)}>Remover</button>
              </div>
            ))}
          </div>
          <div className="addQuickReply">
            <input 
              type="text" 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
              placeholder="Adicionar nova mensagem rápida" 
            />
            <button onClick={() => handleAddQuickReply(newMessage)}>Adicionar</button>
          </div>
        </div>
    </div>
  );
}

export default App;
