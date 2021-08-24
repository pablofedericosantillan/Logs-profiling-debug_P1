console.log(`PID CHILD_PROCESS FORK ${process.pid}`)
 
const getNumRandom1al100 = () => parseInt(Math.random()*100) + 1

function calcularRandoms(cant) {
    let randoms = {}

    for(let i=0; i<cant; i++) {
        let random = getNumRandom1al100()
        if(!randoms[random]) randoms[random] = 1
        else randoms[random]++
    }

    return randoms
}

process.on('message', message => {
    process.send({id: message.id,...calcularRandoms(message.data)})
})