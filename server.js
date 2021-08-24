// -------------- MODO FORK -------------------
//pm2 start server.js --name="Server1" --watch -- 8081 iiiiiiiiiiiiiii ssssssssssssssssssssssssssssssss FORK

// -------------- MODO CLUSTER -------------------
//pm2 start server.js --name="Server2" --watch -- 8082 iiiiiiiiiiiiiii ssssssssssssssssssssssssssssssss CLUSTER

//pm2 list
//pm2 delete id/name
//pm2 desc name
//pm2 monit
//pm2 --help
//pm2 logs
//pm2 flush

// ------------------ NGINX ----------------------
//http://nginx.org/en/docs/windows.html
//start nginx
//tasklist /fi "imagename eq nginx.exe"
//nginx -s reload
//nginx -s quit


const CON_CHILD_PROCESS_FORK = !false

import cluster from 'cluster'

import express from 'express'
import http from 'http'
import { Server as Socket } from 'socket.io'

const app = express()

//----------------------------------------------------------------------
// COMPRESIÓN
//----------------------------------------------------------------------
import compression from 'compression'
app.use(compression())
//----------------------------------------------------------------------

//----------------------------------------------------------------------
// LOGGERS
//----------------------------------------------------------------------
import log4js from 'log4js'
log4js.configure({
    appenders: {
        miLoggerConsole: { type: "console" },
        miLoggerFileWarn: { type: 'file', filename: 'warn.log' },
        miLoggerFileError: { type: 'file', filename: 'error.log' }
    },
    categories: {
        default: { appenders: ["miLoggerConsole"], level: "trace" },
        info: { appenders: ["miLoggerConsole"], level: "info" },
        warn: { appenders: ["miLoggerFileWarn"], level: "warn" },
        error: { appenders: ["miLoggerFileError"], level: "error" }
    }
});

const loggerInfo = log4js.getLogger('info');
const loggerWarn = log4js.getLogger('warn');
const loggerError = log4js.getLogger('error');
//----------------------------------------------------------------------

const server = http.Server(app)
const io = new Socket(server)

import cookieParser from 'cookie-parser'
import session from 'express-session'
import MongoStore from 'connect-mongo'

/* -------------- PASSPORT ----------------- */
import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook'

import handlebars from 'express-handlebars'
import Productos from './api/productos.js'
import Mensajes from './api/mensajes.js'
import { MongoDB } from './db/db.js'

import { fork } from 'child_process'

import * as os from 'os'

const numCPUs = os.cpus().length

const modoCluster = process.argv[5] == 'CLUSTER'

/* --------------------------------------------------------------------------- */
/* MASTER */
if(modoCluster && cluster.isMaster) {

    loggerInfo.info(`Número de procesadores: ${numCPUs}`)
    loggerInfo.info(`PID MASTER ${process.pid}`)

    for(let i=0; i<numCPUs; i++) {
        cluster.fork()
    }

    cluster.on('exit', worker => {
        loggerInfo.info('Worker', worker.process.pid, 'died', new Date().toLocaleString())
        cluster.fork()
    })
}
else {

    const FACEBOOK_CLIENT_ID = process.argv[3] || 'iiiiiiiiiiiiiii';
    const FACEBOOK_CLIENT_SECRET = process.argv[4] || 'ssssssssssssssssssssssssssssssss';
    loggerInfo.info(FACEBOOK_CLIENT_ID)
    loggerInfo.info(FACEBOOK_CLIENT_SECRET)
    
    passport.use(new FacebookStrategy({
    clientID: FACEBOOK_CLIENT_ID,
    clientSecret: FACEBOOK_CLIENT_SECRET,
    callbackURL: '/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'photos', 'emails'],
    scope: ['email']
    }, function(accessToken, refreshToken, profile, done) {
        //loggerInfo.info(profile)
        let userProfile = profile;
        //console.dir(userProfile, {depth: 4, colors: true})
        return done(null, userProfile);
    }));

    passport.serializeUser(function(user, cb) {
    cb(null, user);
    });

    passport.deserializeUser(function(obj, cb) {
    cb(null, obj);
    });


    /* ----------------------------------------- */
    app.use(cookieParser())
    app.use(session({
        store: MongoStore.create({ 
            //En Atlas connect App: Make sure to change the node version to 2.2.12:
            mongoUrl: "mongodb+srv://pfsantillan:35783028@cluster0.kfxor.mongodb.net/ecommerce?retryWrites=true&w=majority",
            //mongoOptions: { useNewUrlParser: true, useUnifiedTopology: true },
            ttl: 600
        }),
        secret: 'shhhhhhhhhhhhhhhhhhhhh',
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
        maxAge: 600000
        }
    }))

    app.use(passport.initialize());
    app.use(passport.session());

    let productos = new Productos()
    let mensajes = new Mensajes()

    //--------------------------------------------
    //establecemos la configuración de handlebars
    app.engine(
        "hbs",
        handlebars({
        extname: ".hbs",
        defaultLayout: 'index.hbs',
        })
    );
    app.set("view engine", "hbs");
    app.set("views", "./views");
    //--------------------------------------------

    app.use(express.static('public'))
   
    /* --------- INFO ---------- */
    app.get('/info', (req,res) => {
        res.render("info", {
            args:  JSON.stringify(process.argv,null,'\t'),
            path: process.execPath,
            plataforma: process.platform,
            pid: process.pid,
            version: process.version,        
            dir: process.cwd(),        
            memoria: JSON.stringify(process.memoryUsage(),null,'\t'),
            numCPUs
        })
    })

    /* --------- RANDOMS ---------- */
    if(CON_CHILD_PROCESS_FORK) {
        let calculo = fork('./calculo.js');

        var taskId = 0;
        var tasks = {};

        function addTask(data, callback) {
            var id = taskId++;
            calculo.send({id: id, data: data});
            tasks[id] = callback;
        };

        calculo.on('message', function(message) {
            tasks[message.id](message);
        });
        
        app.get('/randoms', async (req,res) => {
            addTask(req.query.cant || 100000000, randoms => {
                res.json(randoms)
            });
        })
    }
    else {
        app.get('/randoms', async (req,res) => {
            loggerInfo.info(`randoms -> no implementado!`)
            loggerWarn.warn(`randoms -> no implementado!`)
            res.send('<h2 style="color: orangered;">randoms -> no implementado!</h2>')
        })
    }

    /* -------------------------------------------------------- */
    /* -------------- LOGIN y LOGOUT DE USUARIO --------------- */
    /* -------------------------------------------------------- */
    app.use(express.urlencoded({extended: true}))

    /* --------- LOGIN ---------- */
    app.get('/login', (req,res) => {
        if(req.isAuthenticated()){
            res.render("home", {
            nombre: req.user.displayName,
            foto: req.user.photos[0].value,
            email: req.user.emails[0].value,
            contador: req.user.contador        
            })
        }
        else {
            res.sendFile(process.cwd() + '/public/login.html')
        }
    })

    app.get('/auth/facebook', passport.authenticate('facebook'));
    app.get('/auth/facebook/callback', passport.authenticate('facebook',
    { successRedirect: '/home', 
        failureRedirect: '/faillogin' }
    ));

    app.get('/home', (req,res) => {
    loggerInfo.info(req.user)
        res.redirect('/')        
    })

    app.get('/faillogin', (req,res) => {
        res.render('login-error', {});
    })

    app.get('/logout', (req,res) => {
        let nombre = req.user.displayName
        req.logout()
        res.render("logout", { nombre })
    })
    /* -------------------------------------------------------- */
    /* -------------------------------------------------------- */
    /* -------------------------------------------------------- */

    const router = express.Router()
    app.use('/api', router)

    router.use(express.json())
    router.use(express.urlencoded({extended: true}))


    router.get('/productos/listar', async (req,res) => {
        res.json(await productos.listarAll())
    })

    router.get('/productos/listar/:id', async (req,res) => {
        let { id } = req.params
        res.json(await productos.listar(id))
    })

    router.post('/productos/guardar', async (req,res) => {
        let producto = req.body
        await productos.guardar(producto)
        res.json(producto)
        //res.redirect('/')
    })

    router.put('/productos/actualizar/:id', async (req,res) => {
        let { id } = req.params
        let producto = req.body
        await productos.actualizar(producto,id)
        res.json(producto)
    })

    router.delete('/productos/borrar/:id', async (req,res) => {
        let { id } = req.params
        let producto = await productos.borrar(id)
        res.json(producto)
    })

    router.get('/productos/vista', async (req, res) => {
        let prods = await productos.listarAll()

        res.render("vista", {
            productos: prods,
            hayProductos: prods.length
        })
    })

    router.get('/productos/vista-test', async (req, res) => {

        let cant = req.query.cant || 10
        let prods = []
        for(let i=0; i<cant; i++) prods.push(getProdRandom(i+1))

        //loggerInfo.info(prods)
        res.render("vista", {
            productos: prods,
            hayProductos: prods.length
        })
    })

    /* -------------------- Web Sockets ---------------------- */
    io.on('connection', async socket => {
        loggerInfo.info('Nuevo cliente conectado!');
        
        /* ------------------- */
        /* Info Productos (ws) */
        /* ------------------- */
        /* Envio los mensajes al cliente que se conectó */
        socket.emit('productos', await productos.get());

        /* Escucho los mensajes enviado por el cliente y se los propago a todos */
        socket.on('update', async data => {
            if(data = 'ok') {
                io.sockets.emit('productos',  await productos.get()); 
            }
        })

        /* ----------------------- */
        /* Centro de mensajes (ws) */
        /* ----------------------- */
        socket.emit('messages', await mensajes.getAll());

        socket.on('new-message', async function(data) {
            //loggerInfo.info(data)
            await mensajes.guardar(data); 
            io.sockets.emit('messages', await mensajes.getAll()); 
        })    
    });
    /* ------------------------------------------------------- */
    process.on('exit', code => {
        loggerInfo.info('Salida con código de error: ' + code)
    })

    const PORT = process.env.PORT || Number(process.argv[2]) || 8080;
    const srv = server.listen(PORT, async () => {
        loggerInfo.info(`Servidor http escuchando en el puerto ${srv.address().port} - PID WORKER ${process.pid}`)
        try {
            const mongo = new MongoDB('mongodb://localhost:27017/ecommerce')
            await mongo.conectar()
            loggerInfo.info('base MongoDB conectada')
        }
        catch(error) {
            loggerInfo.info(`Error en conexión de Base de datos: ${error}`)
            loggerError.error(`Error en conexión de Base de datos: ${error}`)
        }
    })
    srv.on("error", error => {
        loggerInfo.info(`Error en servidor ${error}`)
        loggerError.error(`Error en servidor ${error}`)
    })
}