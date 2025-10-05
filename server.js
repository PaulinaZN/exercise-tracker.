const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require('mongoose')
const { Schema } = mongoose

// ************************************************
// 🛑 CORRECCIÓN CRÍTICA: Asegurar la conexión a MongoDB
// ************************************************
// Render/Glitch/etc. usa `process.env.MONGO_URI` si lo has configurado.
// Para evitar errores de Mongoose, envuelve la conexión en un bloque try/catch
// o usa .then/.catch (como ya lo hiciste, pero asegúrate de que la URI exista).
// Si tu variable de Render es MONGO_URI, déjalo así. Si es MONGODB_URI, cámbiala.
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/exercise-tracker')
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err.message));


const userSchema = new Schema({
  username: String
});
const User = mongoose.model('User', userSchema)

const exerciseSchema = new Schema({
  user_id: { type: String, required: true },
  description: { type: String, required: true }, // 🛑 Mejora: Añadir 'required'
  duration: { type: Number, required: true }, // 🛑 Mejora: Añadir 'required'
  date: Date
})
const Exercise = mongoose.model('Exercise', exerciseSchema)


app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json()); // Añadir body parser para JSON, aunque urlencoded es suficiente aquí.
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// ************************************************
// RUTAS DE USUARIOS
// ************************************************

app.get("/api/users", async (req, res) => {
  const users = await User.find({}).select("_id username")
  // No es necesario verificar !users, Mongoose devolverá un array vacío si no hay.
  res.json(users)
})

app.post("/api/users", async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.json({ error: "Username is required" });
  }

  const userObj = new User({ username });
  try {
    const user = await userObj.save()
    res.json(user) // Mongoose devuelve { _id: ..., username: ... }
  } catch (error) {
    // Si la DB tiene un índice único, este es el lugar para manejar errores de duplicados.
    res.status(500).json({ error: "Could not create user" });
  }
})

// ************************************************
// RUTAS DE EJERCICIOS
// ************************************************

app.post("/api/users/:_id/exercises", async (req, res) => {
  const id = req.params._id
  const { description, duration, date } = req.body

  // 🛑 Validación necesaria para FreeCodeCamp
  if (!description || !duration) {
    return res.json({ error: "Description and duration are required fields." });
  }

  try {
    // Convertir duration a número antes de usarlo.
    const durationNum = parseInt(duration);
    if (isNaN(durationNum)) {
        return res.json({ error: "Duration must be a number." });
    }
    
    const user = await User.findById(id)
    if (!user) {
      // 🛑 Se recomienda usar status 404 para "no encontrado"
      return res.status(404).send('Could not find user')
    }
    
    const exerciseObj = new Exercise({
      user_id: user._id,
      description,
      duration: durationNum,
      // Date: si 'date' existe, úsalo; si no, usa la fecha actual.
      date: date ? new Date(date) : new Date()
    })
    
    const exercise = await exerciseObj.save()

    // 🛑 Formato de respuesta requerido por FreeCodeCamp
    res.json({
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: new Date(exercise.date).toDateString(),
      _id: user._id,
    })
    
  } catch (err) {
    // console.error(err); // Usar console.error es mejor para errores
    res.status(500).json({ error: "Error saving exercise: " + err.message })
  }
})

// ************************************************
// RUTAS DE REGISTRO (LOGS)
// ************************************************

app.get("/api/users/:_id/logs", async (req, res) => {
  const { from, to, limit } = req.query
  const id = req.params._id
  const user = await User.findById(id)

  if (!user) {
    // 🛑 Mejor usar 404
    return res.status(404).send("Could not find user")
  }

  let dateObj = {}
  if (from) {
    dateObj["$gte"] = new Date(from)
  }
  if (to) {
    dateObj["$lte"] = new Date(to)
  }

  let filter = {
    user_id: id
  }

  if (from || to) {
    filter.date = dateObj
  }

  // Corregido: Si `limit` no está definido, se usa 0, que Mongoose interpreta como sin límite.
  // Usar `limit` como número entero.
  const limitNum = parseInt(limit);
  const exercises = await Exercise.find(filter).limit(limitNum) 

  const log = exercises.map(ex => ({
    description: ex.description,
    duration: ex.duration,
    // La fecha ya es un objeto Date, toDateString es el método correcto
    date: ex.date.toDateString() 
  }))

  // 🛑 Formato de respuesta requerido por FreeCodeCamp
  res.json({
    username: user.username,
    count: exercises.length,
    _id: user.id,
    log
  })
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
