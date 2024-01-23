c   onst express = require('express');
const cors = require('cors');

var jwt = require('jsonwebtoken');

require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app=express()
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port=process.env.PORT || 5000

app.use(cors())
app.use(express.json())



// project no 2 probably



const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.2vmm6g8.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const contestCollection = client.db("contest-site").collection("contest");
    const contestregistrationCollection = client.db("contest-site").collection("registration");
    const userData = client.db("contest-site").collection("user");
    const PaymentCollection = client.db("contest-site").collection("payment");




 // middleware
 const verifytoken = (req, res, next) => {
  console.log("inside verify token ", req.headers);
  console.log(req.headers);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "forbidden access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};


const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userData.findOne(query);
  const isadmin = user?.role === "admin";
  if (!isadmin) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};






// jwt

app.post("/jwt", async (req, res) => {
  console.log(req.headers)
  const user = req.body;
  const token = jwt.sign(user, process.env.SECRET_TOKEN, {
    expiresIn: "1h",
  });
  res.send({ token });
});












app.get('/contest',async(req,res)=>{
  const page = parseInt(req.query.page);
  const size = parseInt(req.query.size);

  const cursor = contestCollection.find();
  const result = await cursor
    .skip(page * size)
    .limit(size)
    .toArray();
  res.send(result);
})

app.post('/contest',async(req,res)=>{
  const user = req.body;

  const result = await contestCollection.insertOne(user);
  res.send(result)
})

app.get("/contestcount", async (req, res) => {
  const count = await contestCollection.estimatedDocumentCount();
  res.send({ count });
});

app.get("/singlecontest/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await contestCollection.findOne(query);
  res.send(result);
});


app.put("/singlecontest/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };
  const update = req.body;
  const updatecontest = {

    $set: {
      ContestName: update.ContestName,
      Image: update.Image,
      Description: update.Description,
      ContestPrice: update.ContestPrice,
      PrizeMoney: update.PrizeMoney,
      TaskSubmissionTextInstruction: update.TaskSubmissionTextInstruction,
      Category: update.Category,
      Deadline: update.Deadline,
      email: update.email,
    },
  };
  const result = await contestCollection.updateOne(
    filter,
    updatecontest,
    options
  );
  res.send(result);
});


app.delete("/singlecontest/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await contestCollection.deleteOne(query);
  res.send(result);
});


// user

app.post('/user',async(req,res)=>{
  const user = req.body;

  const result = await userData.insertOne(user);
  res.send(result);
})

app.get('/user', verifytoken,async(req,res)=>{
  const result = await userData.find().toArray();
  res.send(result);
})

app.get("/user/admin/:email", verifytoken, async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded.email) {
    res.send({ admin: false });
  }
  const query = { email: email };
  const user = await userData.findOne(query);
  let admin = false;
  if (user) {
    admin = user?.role === "admin";
  }
  res.send({ admin });
});


app.get("/user/moderator/:email",  async (req, res) => {
  const email = req.params.email;

  const query = { email: email };
  const user = await userData.findOne(query);
  let moderator = false;
  if (user) {
    moderator = user?.role === "moderator";
  }
  res.send({ moderator });
});




app.patch("/user/admin/:id",  async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updatedoc = {
    $set: {
      role: "admin",
    },
  };
  const result = await userData.updateOne(filter, updatedoc);
  res.send(result);
});




app.delete("/user/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await userData.deleteOne(query);
  res.send(result);
});



app.post('/mycontest',async(req,res)=>{
  const user = req.body;

  const result = await contestregistrationCollection.insertOne(user);
  res.send(result);
})

app.get('/mycontest',async(req,res)=>{
 
      const result = await contestregistrationCollection.find().toArray();
      res.send(result);
})


   // payment intent
   app.post("/create-payment-intent", async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    console.log(amount, "amount inside the intent");

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      payment_method_types: ["card"],
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  });
  app.post("/payment", async (req, res) => {
    const payment = req.body;
    const result = await PaymentCollection.insertOne(payment);
    const query = {
      _id: {
        $in: payment.cartIds.map((id) => new ObjectId(id)),
      },
    };
    const deleteresult = await contestregistrationCollection.deleteMany(query);
    res.send({ result, deleteresult });
  });




    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);











app.get('/',(req,res)=>{
res.send(' contest server is running')
})
app.listen(port,()=>{
    console.log('contest site is running')
})

