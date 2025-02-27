require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors({
  origin: ["http://localhost:5173", "https://task-management-d4708.web.app"], 
  credentials: true,
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.whalj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://task-management-d4708.web.app"], 
    
    credentials: true,
  },
});

let taskCollection;
let activityCollection;

async function run() {
  try {
    taskCollection = client.db("taskManagement").collection("tasks");
    activityCollection = client.db("taskManagement").collection("activities");
    const changeStream = taskCollection.watch();
    changeStream.on("change", (change) => {
      io.emit("taskChange", change);
    });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Task Management API is Running");
});

app.get("/tasks", (req, res) => {
  taskCollection.find({}).toArray()
    .then(tasks => res.json(tasks))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.get("/tasks/:userEmail", (req, res) => {
  const { userEmail } = req.params;
  taskCollection.find({ userEmail }).toArray()
    .then(tasks => res.json(tasks))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.post("/tasks", (req, res) => {
  const task = req.body;
  taskCollection.insertOne(task)
    .then(result => res.json(result))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.put("/tasks/:id", (req, res) => {
  const { id } = req.params;
  const updatedTask = req.body;
  taskCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedTask }
  )
    .then(result => res.json(result))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.delete("/tasks/:id", (req, res) => {
  const { id } = req.params;
  taskCollection.deleteOne({ _id: new ObjectId(id) })
    .then(result => res.json(result))
    .catch(error => res.status(500).json({ error: error.message }));
});

// Middleware to verify JWT and extract user email
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.sendStatus(403);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

app.get("/activities", authenticateJWT, (req, res) => {
  activityCollection.find({ userEmail: req.user.email }).toArray()
    .then(activities => res.json(activities))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.post("/activities", authenticateJWT, (req, res) => {
  const activity = { ...req.body, userEmail: req.user.email };
  activityCollection.insertOne(activity)
    .then(result => res.json(result))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.delete("/activities/:id", (req, res) => {
  const { id } = req.params;
  activityCollection.deleteOne({ _id: new ObjectId(id) })
    .then(result => res.json(result))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.delete("/activities", (req, res) => {
  activityCollection.deleteMany({})
    .then(result => res.json(result))
    .catch(error => res.status(500).json({ error: error.message }));
});

// JWT endpoint
app.post("/jwt", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET is not defined" });
  }
  try {
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
