const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config(); 
const mongoose = require('mongoose');
const { Schema } = mongoose;

// ================================================
// CONEXIÓN A MONGODB
// ================================================

const MONGO_URI = process.env.MONGO_URI;

// Bloque de conexión robusto
if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in environment variables.");
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
      console.error('MongoDB connection failed! Check MONGO_URI value and MongoDB Atlas IP access.');
      console.error(err.message); 
  });


// ================================================
// SCHEMAS Y MODELOS
// ================================================

const userSchema = new Schema({
  username: String
});
const User = mongoose.model('User', userSchema);

const exerciseSchema = new Schema({
  user_id: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: Date
});
const Exercise = mongoose.model('Exercise', exerciseSchema);


// ================================================
// MIDDLEWARES
// ================================================

app.use(cors());
// Middleware CRÍTICO: Necesario para que req.body lea 'form data'
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// ================================================
// RUTAS DE USUARIOS
// ================================================

// 2, 3. POST /api/users: Crear un nuevo usuario
app.post("/api/users", async (req, res) => {
  // Aseguramos que solo se tome el username del body
  const { username } = req.body; 
  
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const userObj = new User({ username });
  try {
    const user = await userObj.save();
    // Respuesta: objeto con username y _id (formato exacto de FCC)
    res.json({
        username: user.username,
        _id: user._id
    });
  } catch (error) {
    res.status(500).json({ error: "Could not create user" });
  }
});

// 4, 5, 6. GET /api/users: Obtener lista de todos los usuarios
app.get("/api/users", async (req, res) => {
  try {
    // Selectamos SOLO _id y username para el formato exacto de FCC
    const users = await User.find({}).select("_id username");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Could not retrieve users" });
  }
});


// ================================================
// RUTAS DE EJERCICIOS
// ================================================

// 7, 8. POST /api/users/:_id/exercises: Agregar un ejercicio
app.post("/api/users/:_id/exercises", async (req, res) => {
  const id = req.params._id;
  const { description, duration, date } = req.body;

  if (!description || !duration) {
    return res.status(400).json({ error: "Description and duration are required fields." });
  }

  const durationNum = parseInt(duration);
  if (isNaN(durationNum)) {
      return res.status(400).json({ error: "Duration must be a number." });
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send('Could not find user');
    }
    
    const exerciseObj = new Exercise({
      user_id: user._id,
      description,
      duration: durationNum,
      date: date ? new Date(date) : new Date() 
    });
    
    const exercise = await exerciseObj.save();

    // Respuesta con el formato exacto requerido por FCC
    res.json({
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      // CRÍTICO: Usar toDateString()
      date: new Date(exercise.date).toDateString(), 
      _id: user._id, // ID del USUARIO
    });
    
  } catch (err) {
    console.error("Error saving exercise:", err);
    res.status(500).json({ error: "Error saving exercise: " + err.message });
  }
});


// ================================================
// RUTAS DE REGISTRO (LOGS)
// ================================================

// 9-16. GET /api/users/:_id/logs: Logs con filtros
app.get("/api/users/:_id/logs", async (req, res) => {
  const { from, to, limit } = req.query;
  const id = req.params._id;
  
  const user = await User.findById(id);

  if (!user) {
    return res.status(404).send("Could not find user");
  }

  let dateObj = {};
  let filter = { user_id: id };
  
  // Filtros 'from' y 'to' (yyyy-mm-dd)
  if (from) {
    dateObj["$gte"] = new Date(from);
  }
  if (to) {
    dateObj["$lte"] = new Date(to);
  }

  if (from || to) {
    filter.date = dateObj;
  }
  
  // Filtro 'limit'
  const limitNum = parseInt(limit);
  const exercises = await Exercise.find(filter).limit(limitNum || 0); 

  // Mapear los ejercicios al formato requerido
  const log = exercises.map(ex => ({
    description: ex.description, 
    duration: ex.duration,       
    date: ex.date.toDateString() // CRÍTICO: Formato DateString
  }));

  // Respuesta con count y log array
  res.json({
    username: user.username,
    count: exercises.length,
    _id: user.id,
    log
  });
});


// ================================================
// INICIO DEL SERVIDOR
// ================================================

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
