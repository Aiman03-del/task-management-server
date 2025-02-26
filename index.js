require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors({
  origin: "http://localhost:5173", 
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
    origin: "http://localhost:5173", 
    credentials: true,
  },
});

let taskCollection;
let activityCollection;

async function run() {
  try {
    await client.connect();
    taskCollection = client.db("taskManagement").collection("tasks");
    activityCollection = client.db("taskManagement").collection("activities");
    const changeStream = taskCollection.watch();
    changeStream.on("change", (change) => {
      io.emit("taskChange", change);
    });
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Task Management API is Running");
});

app.get("/tasks", async (req, res) => {
  const tasks = await taskCollection.find({}).toArray();
  res.json(tasks);
});

app.get("/tasks/:userEmail", async (req, res) => {
  const { userEmail } = req.params;
  const tasks = await taskCollection.find({ userEmail }).toArray();
  res.json(tasks);
});

app.post("/tasks", async (req, res) => {
  const task = req.body;
  const result = await taskCollection.insertOne(task);
  res.json(result);
});

app.put("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const updatedTask = req.body;
  const result = await taskCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedTask }
  );
  res.json(result);
});

app.delete("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const result = await taskCollection.deleteOne({ _id: new ObjectId(id) });
  res.json(result);
});

app.get("/activities", async (req, res) => {
  const activities = await activityCollection.find({}).toArray();
  res.json(activities);
});

app.post("/activities", async (req, res) => {
  const activity = req.body;
  const result = await activityCollection.insertOne(activity);
  res.json(result);
});

app.delete("/activities/:id", async (req, res) => {
  const { id } = req.params;
  const result = await activityCollection.deleteOne({ _id: new ObjectId(id) });
  res.json(result);
});

app.delete("/activities", async (req, res) => {
  const result = await activityCollection.deleteMany({});
  res.json(result);
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
