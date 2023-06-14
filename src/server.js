const express = require('express');
const app = express();


app.set('view engine', 'ejs');

const http = require("http").createServer(app);
const io = require("socket.io")(http)
const wppconnect = require('@wppconnect-team/wppconnect');
const port = 3000;
var userStages = [];
let studentData = null;
// let mensagensRecebidas = {
//     mensagens: [],
//     contador: {}
// };
let mensagensRecebidas = [];

const wppSession = wppconnect.create({
    session: 'whatsbot',
    autoClose: false,
    puppeteerOptions: { args: ['--no-sandbox'] }
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
        transferirParaAtendente(){
            return {
                status: 'TRANSFERIDO',
                message: "Estamos transferindo você para um atendente.",
            }
        }
    },
    {},
    {},
    {},
]

wppSession.then((client)=>{
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

            io.emit("nova-mensagem", mensagensRecebidas);
        }
    })
}).catch((erro)=>{
    console.error("Erro ao iniciar a sessão: ", erro)
})

async function stages(client, message) {
    let stage = userStages[message.from];
    if(stage == undefined){
    
        sendWppMessage(client, message.from, "Olá! Tudo bem? Eu sou a Aya. Escolha uma das opções abaixo: ")

        setTimeout(() => {
            sendWppMessage(client, message.from, "*Digite 1, se já é aluno*\n*Digite 2, se não é aluno*")
        }, 500);
        userStages[message.from] = "OPCAO";
    }else{
        let opcao = message.body.split(" ").join(",");

        if(stage == "OPCAO"){
            if(opcao == '1'){
                sendWppMessage(client, message.from, "Que bom que já é nosso aluno. Agora, por favor, digite seu *nome completo*:")
                let nome = message.body;
                userStages[message.from] = "NOME"
            }else if(opcao == '2'){
                sendWppMessage(client, message.from, "Que bom tê-lo conosco. Agora, digite seu nome completo!")
                userStages[message.from] = "NOME"
            }else{
                sendWppMessage(client, message.from, "*Digite 1, se já é aluno*\n*Digite 2, se não é aluno*")
                userStages[message.from] = "OPCAO"
            }
        }
        if(stage == 'NOME'){
            let nome = message.body.trim();
            await findStudent(nome).then(student =>{
                if(student.error == false){
                    studentData = student;
                }
            });

            if(studentData){
                sendWppMessage(client, message.from, `Tudo bem, ${studentData.data.NomeAluno}! Agora diga-me como posso te ajudar: `);
                setTimeout(() => {
                    sendWppMessage(client, message.from, "1 - DÚVIDA NA AULA\n2 - INFORMAÇÃO FINANCEIRA\n3 - MUDANÇA DE HORÁRIO\n4 - CANAIS DE ATENDIMENTO")
                }, 500);
                userStages[message.from] = "AJUDA"
            }else{
                sendWppMessage(client, message.from, "Infelizmente não encontramos você no nosso banco de dados.");
                userStages[message.from] = undefined;
            }    
        }
        if(stage == "AJUDA"){
            let ajudaNumber = parseInt(message.body);
            if(!isNaN(ajudaNumber)){
                let ajuda = AJUDA[ajudaNumber] ? AJUDA[ajudaNumber].transferirParaAtendente:"";
                let dados = ajuda();
                sendWppMessage(client, message.from, dados.message);
                userStages[message.from] = dados.status;
            }else{
                sendWppMessage(client, message.from, "1 - DÚVIDA NA AULA\n2 - INFORMAÇÃO FINANCEIRA\n3 - MUDANÇA DE HORÁRIO\n4 - CANAIS DE ATENDIMENTO")
            }
            
        }  
        if(stage == "FIM"){
            sendWppMessage(client, message.from, "Espere que logo será atendido.")
            userStages[message.from] = undefined
        }
        if(stage == "TRANSFERIDO"){
            setTimeout(() => {
                sendWppMessage(client, message.from, "Atendimento encerrado");
                userStages[message.from] = undefined;
            }, 1000 * 60);
        }
    }
}


function sendWppMessage(client, sendTo, text) {
    client
        .sendText(sendTo, text)
        .then((result) => {
            // console.log('SUCESSO: ', result); 
        })
        .catch((erro) => {
            console.error('ERRO: ', erro);
        });
}
function sendWppMessage(client, sendTo, text) {
    client
        .sendText(sendTo, text)
        .then((result) => {
            // console.log('SUCESSO: ', result); 
        })
        .catch((erro) => {
            console.error('ERRO: ', erro);
        });
}

io.on('connection', (socket)=>{
    console.log("Novo cliente conectado");
    socket.on('disconnect', ()=>{
        console.log("Cliente desconectado");
    })
})

app.get('/', (req, res)=>{
    console.log(mensagensRecebidas)
    res.render("index", {mensagens: mensagensRecebidas});
    // const {body} = req;
    // console.log('Mensagens recebidas', body)
    // res.status(200).send('Mensagens recebidas');
})

app.get('/encerrar-conversa', (req, res)=>{
    res.render("encerrar")
})

http.listen(port, ()=>{
    console.log("Servidor rodando na porta 3000")
})