const express = require('express');
const app = express();
const cors = require('cors');
// La librería dotenv se usa para leer .env LÓCALMENTE. 
// En Render, process.env ya está disponible, pero la dejamos por si desarrollas en local.
require('dotenv').config(); 
const mongoose = require('mongoose');
const { Schema } = mongoose;

// ************************************************
// 🛑 CONEXIÓN A MONGODB
// ************************************************

const MONGO_URI = process.env.MONGO_URI;

// Verificamos si la URI existe antes de intentar conectar
if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in environment variables. Please check your Render configuration.");
    // No cerraremos la app inmediatamente, pero loguearemos el error.
    // La conexión a Mongoose fallará en el .catch.
}

// Intentamos la conexión. Si MONGO_URI es 'undefined', Mongoose lo atrapará en el .catch
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
      console.error('MongoDB connection failed. Check MONGO_URI variable.');
      // El error ECONNREFUSED es capturado aquí si falla el fallback
      console.error(err.message); 
  });


// ************************************************
// SCHEMAS Y MODELOS
// ************************************************

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


// ************************************************
// MIDDLEWARES
// ************************************************

app.use(cors());
// Usamos urlencoded para manejar los datos del formulario (form data)
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); // Necesario para manejar cuerpos JSON
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});


// ************************************************
// RUTAS DE USUARIOS
// ************************************************

// 4. GET /api/users: Obtener lista de todos los usuarios
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}).select("_id username");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Could not retrieve users" });
  }
});

// 2. POST /api/users: Crear un nuevo usuario
app.post("/api/users", async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.json({ error: "Username is required" });
  }

  const userObj = new User({ username });
  try {
    const user = await userObj.save();
    // 3. Respuesta: objeto con username y _id
    res.json({
        username: user.username,
        _id: user._id
    });
  } catch (error) {
    res.status(500).json({ error: "Could not create user" });
  }
});


// ************************************************
// RUTAS DE EJERCICIOS
// ************************************************

// 7. POST /api/users/:_id/exercises: Agregar un ejercicio
app.post("/api/users/:_id/exercises", async (req, res) => {
  const id = req.params._id;
  const { description, duration, date } = req.body;

  // 🛑 Validación: description y duration son requeridos
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
      // 7. Si no se proporciona fecha, se usa la fecha actual
      date: date ? new Date(date) : new Date() 
    });
    
    const exercise = await exerciseObj.save();

    // 8. Respuesta: objeto de usuario con campos de ejercicio
    res.json({
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      // 15. Formato DateString es CRÍTICO para pasar el test
      date: new Date(exercise.date).toDateString(), 
      _id: user._id,
    });
    
  } catch (err) {
    console.error("Error saving exercise:", err);
    res.status(500).json({ error: "Error saving exercise: " + err.message });
  }
});


// ************************************************
// RUTAS DE REGISTRO (LOGS)
// ************************************************

// 9. GET /api/users/:_id/logs: Recuperar el registro de ejercicios
app.get("/api/users/:_id/logs", async (req, res) => {
  const { from, to, limit } = req.query;
  const id = req.params._id;
  
  const user = await User.findById(id);

  if (!user) {
    return res.status(404).send("Could not find user");
  }

  let dateObj = {};
  let filter = { user_id: id };
  
  // 16. Filtros 'from' y 'to'
  if (from) {
    dateObj["$gte"] = new Date(from);
  }
  if (to) {
    dateObj["$lte"] = new Date(to);
  }

  if (from || to) {
    filter.date = dateObj;
  }
  
  // 16. Filtro 'limit'
  const limitNum = parseInt(limit);
  // Si limit es NaN o 0, Mongoose no aplica límite, que es el comportamiento deseado.
  const exercises = await Exercise.find(filter).limit(limitNum || 0); 

  // 12. Mapear los ejercicios al formato requerido
  const log = exercises.map(ex => ({
    description: ex.description, // 13. Debe ser string
    duration: ex.duration,       // 14. Debe ser número
    date: ex.date.toDateString() // 15. Debe ser DateString
  }));

  // 10, 11. Respuesta con count y log array
  res.json({
    username: user.username,
    count: exercises.length,
    _id: user.id,
    log
  });
});


// ************************************************
// INICIO DEL SERVIDOR
// ************************************************

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
