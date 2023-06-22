const express = require('express');
const app = express();
const fs = require("fs");
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.use(express.static('public'))
const http = require("http").createServer(app);
const io = require("socket.io")(http)
const wppconnect = require('@wppconnect-team/wppconnect');
const port = 3000;
var userStages = [];
let studentData = null;
let atendimentoHumanoAtivo = false;
// let mensagensRecebidas = {
//     mensagens: [],
//     contador: {}
// };
let mensagensRecebidas = [];
let users = [];

const wppSession = wppconnect.create({
    session: 'whatsbot',
    autoClose: false,
    puppeteerOptions: { args: ['--no-sandbox'] },
    catchQR: (base64Qr, asciiQR) => {
        console.log(asciiQR); // Optional to log the QR in the terminal

        var matches = base64Qr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
          response = {};
  
        if (matches.length !== 3) {
          return new Error('Invalid input string');
        }
        response.type = matches[1];
        response.data = new Buffer.from(matches[2], 'base64');
  
        var imageBuffer = response;
        require('fs').writeFile(
          'public/out.png',
          imageBuffer['data'],
          'binary',
          function (err) {
            if (err != null) {
              console.log(err);
            }
          }
        );
          io.emit("img");
      },
      logQR: false,
})

async function findStudent(studentName){
    let data = new FormData;
    data.append("NomeAluno", studentName);
    let response = await fetch("http://localhost/testando/findByName.php?NomeAluno", {method:"POST",body: data})
    let student = await response.json();
    return student;
}

const AJUDA = [{},
    {
        resposta(){
            return {
                status: 'TRANSFERIDO',
                message: "Transferimos você para um atendente. Aguarde um pouco...",
                notificarPara: ['558597284507@c.us'],
            }
        }
    },
    {
        resposta(){
            return {
                status: "FINANCEIRO",
                message: "Para saber mais sobre sua situação financeira você deverá entrar em contato com o setor administrativo. Abaixo o número:",
                contato: {
                    displayName: 'Cleane administrativo',
                    phoneNumber: '558591116429@c.us',
                }
            }
        }
    },
    {
        resposta(){
            return {
                status: "HORARIO",
                message: "Para mudanças de horários é preciso comparecer presencialmente a unidade da Prepara Cursos Carlito Pamplona que fica na Av. Francisco Sá, 4107 - Carlito Pamplona."
            }
        }
    },
    {
        resposta(){
            return{
                status: "CANAIS",
                message: "Nossos canais de atendimento são:\n\n*Telefone fixo:* (85) 3236-6006\n*Sala de aula: (85) 9654-1425\*n*Administrativo: (85) 9111-6429*"
            }
        }
    },
    {
        resposta(){
            return{
                status: "JUSTIFICAR",
                message: "Descreva abaixo o motivo da sua falta para que possamos justificá-la no sistema: "
            }
        }
    }
]

wppSession.then((client)=>{
    io.emit("conectado");
    client.onMessage((message)=>{
        
        if(message.from == "558596541425@c.us"){
          
            if(mensagensRecebidas.length > 0){
                mensagensRecebidas.forEach( mensagemRecebida =>{
                    if(mensagemRecebida.usuario == message.from){
                        mensagemRecebida.mensagens.push(message)
                    }
                })
            }else{
                mensagensRecebidas.push({
                    usuario: message.from,
                    mensagens: [message]
                })
            }
   
            stages(client, message);
            
        }
    })
}).catch((erro)=>{
    console.error("Erro ao iniciar a sessão: ", erro)
})

async function stages(client, message) {
    let stage = userStages[message.from];

    if(stage == undefined){
        await sendWppMessage(client, message.from, "Olá! Tudo bem? Eu sou a Aya, atendente virtual da Prepara Cursos. Antes de começarmos escolha uma das opções abaixo: ")
        await sendWppMessage(client, message.from, "*Digite 1, se já é aluno*\n*Digite 2, se não é aluno*\n *ESTA É UMA MENSAGEM AUTOMÁTICA NÃO ENVIE ÁUDIOS E NEM IMAGENS.*")
        userStages[message.from] = "OPCAO";
    }else{
        let opcao = message.body.split(" ").join(",");
        if(stage == "OPCAO"){
            if(opcao == '1'){
                await sendWppMessage(client, message.from, "Que bom que já é nosso aluno. Agora, por favor, digite seu *nome completo*:")
                let nome = message.body;
                userStages[message.from] = "NOME"
            }else if(opcao == '2'){
                await sendWppMessage(client, message.from, "Que bom tê-lo conosco. Agora, digite seu *nome completo:*")
                userStages[message.from] = "NOME"
            }else{
                await sendWppMessage(client, message.from, "Desculpe, não entendi, por favor, escolha uma das opções abaixo: ");
                await sendWppMessage(client, message.from, "*Digite 1, se já é aluno*\n*Digite 2, se não é aluno*")
                userStages[message.from] = "OPCAO"
            }
        }
        if(stage == 'NOME'){
            let nome = message.body.trim();
            await sendWppMessage(client, message.from, `Aguarde um pouco...`);
            
            await findStudent(nome).then(student =>{
                if(student.error == false){
                    studentData = student;
                }else{
                    studentData = {
                        data: {NomeAluno: nome },
                    }
                }
            });

            if(studentData){
                await sendWppMessage(client, message.from, `Tudo bem, ${studentData.data.NomeAluno}! Agora diga-me, digitando o número corresponde a opção, como posso te ajudar: `);
                await sendWppMessage(client, message.from, "1 - DÚVIDA NA AULA\n2 - INFORMAÇÃO FINANCEIRA\n3 - MUDANÇA DE HORÁRIO\n4 - CANAIS DE ATENDIMENTO\n5 - JUSTIFICAR FALTA")
                userStages[message.from] = "AJUDA"
            }else{
                await sendWppMessage(client, message.from, "Infelizmente não encontramos você no nosso banco de dados.");
                userStages[message.from] = undefined;
            }    
        }
        if(stage == "AJUDA"){
            let ajudaNumber = parseInt(message.body);
            if(!isNaN(ajudaNumber)){
                let ajuda = AJUDA[ajudaNumber] ? AJUDA[ajudaNumber].resposta:"";
                let dados = ajuda();
                if(dados.status == "TRANSFERIDO"){
                    if(!users.includes(message.from)){
                        users.push(message.from);
                    }
                    io.emit("users", users);
                    await client.setProfileStatus("composing").then(()=>{
                        console.log("Atendimento automático pausado")
                        dados.notificarPara.forEach( i =>{
                            sendWppMessage(client, i, "Há uma nova mensagem.");
                        })
                        atendimentoHumanoAtivo = true;
                    })
                    await sendWppMessage(client, message.from, dados.message);
                    userStages[message.from] = dados.status;
                }else if(dados.status == "FINANCEIRO"){
                    await sendWppMessage(client, message.from, dados.message);
                    await sendContactInfo(client, message.from, dados.contato.phoneNumber, dados.contato.displayName)
                    userStages[message.from] = undefined;
                }else if(dados.status == "HORARIO"){
                    await sendWppMessage(client, message.from, dados.message);
                    userStages[message.from] = undefined;
                }else if(dados.status == "CANAIS"){
                    await sendWppMessage(client, message.from, dados.message);
                    userStages[message.from] = undefined;
                }else if(dados.status == "JUSTIFICAR"){
                    await sendWppMessage(client, message.from, dados.message);
                }
            }else{
                await sendWppMessage(client, message.from, "Desculpe, não entendi, por favor, escolha uma das opções abaixo: ");
                await sendWppMessage(client, message.from, "1 - DÚVIDA NA AULA\n2 - INFORMAÇÃO FINANCEIRA\n3 - MUDANÇA DE HORÁRIO\n4 - CANAIS DE ATENDIMENTO\n5- JUSTIFICAR FALTA")
            }
            
        }          
    }
}


async function sendWppMessage(client, sendTo, text) {
    let response = await client
        .sendText(sendTo, text)
        .then((result) => {
            return {from: text.from, message: result.body.trim().toLowerCase()};
        })
        .catch((erro) => {
            console.error('ERRO: ', erro);
        });
        console.log(response);
        return response;
}

async function sendContactInfo(client, sendTo, contato, name) {
    client.sendContactVcard(sendTo, contato, name)
    .then((res)=>{
        console.log(res)
    }).then((err)=>{
        console.log(err)
    })
}

io.on('connection', (socket)=>{
    console.log("Novo cliente conectado");
    socket.emit("img");
    socket.emit('users', users);
    socket.on('disconnect', ()=>{
        console.log("Cliente desconectado");
    })
})

app.get('/', (req, res)=>{
    res.render("index", {users});
    // const {body} = req;
    // console.log('Mensagens recebidas', body)
    // res.status(200).send('Mensagens recebidas');
})

app.get("/messages", (req, res)=>{

    res.render("messages", {users});
})
app.get('/finalizar-chat', (req, res) => {
    const { user } = req.query;
    console.log(user);
    // Verifica se o usuário existe na lista de usuários
    if (users.includes(user)) {
        wppSession.then((client)=>{
            client.sendText(user, "Atendimento finalizado");
        })
        atendimentoHumanoAtivo = false;
        userStages[user] = undefined;
      // Remove o usuário da lista
      users = users.filter((u) => u !== user);
  
      // Emitir o evento 'users' para enviar a lista atualizada de usuários para todos os clientes conectados
      io.emit('users', users);
        
      // Retornar uma resposta de sucesso
      res.redirect("/");
    }
  
    // Retornar uma resposta de erro caso o usuário não exista
    // return res.status(404).send('Usuário não encontrado');
  });



http.listen(port, ()=>{
    console.log("Servidor rodando na porta 3000")
})