const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const secret = process.env.ACCESS_TOKEN_SECRET;
// const stripe = require("stripe")(process.env.SECRET_KEY);
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_CLUSTER}.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

app.get("/", (req, res) => {
	res.redirect("https://gs-brainbox.web.app/");
});

const run = async () => {
	try {
		// await client.connect();
		const usersColl = client.db("BrainboxDB").collection("users");

		//

		const verifyToken = (req, res, next) => {
			if (!req.headers.authorization) {
				return res.status(401).send({ message: "unauthorized access" });
			}

			const token = req.headers.authorization.split(" ")[1];

			jwt.verify(token, secret, (error, decoded) => {
				if (error) {
					return res
						.status(401)
						.send({ message: "unauthorized access" });
				}

				req.decoded = decoded;
				next();
			});
		};

		app.post("/auth", (req, res) => {
			const token = jwt.sign(req.body, secret, { expiresIn: "1h" });
			res.send({ token });
		});

		app.post("/users", async (req, res) => {
			const { email } = req.body;
			const update = { $set: req.body };
			const upsert = { upsert: true };
			const result = await usersColl.updateOne({ email }, update, upsert);
			res.send(result);
		});

		//

		app.get("/payments/:email", verifyToken, async (req, res) => {
			const { email } = req.params;
			const result = await paymentsColl.find({ email }).toArray();
			res.send(result);
		});

		app.post("/create-payment-intent", verifyToken, async (req, res) => {
			const amount = parseInt(req.body.price * 100);
			const payment_method_types = ["card"];
			const intent = { amount, currency: "usd", payment_method_types };
			const paymentIntent = await stripe.paymentIntents.create(intent);
			res.send({ clientSecret: paymentIntent.client_secret });
		});

		app.post("/payments", verifyToken, async (req, res) => {
			const result = await paymentsColl.insertOne(req.body);
			const objectIDs = req.body.dataIDs.map((id) => new ObjectId(id));
			const filter = { _id: { $in: objectIDs } };

			if (req.body.category === "Food Order") {
				await cartsColl.deleteMany(filter);
			} else if (req.body.category === "Table Booking") {
				const update = { $set: { paid: true } };
				await bookingsColl.updateMany(filter, update);
			}

			res.send(result);
		});
	} finally {
		// await client.close();
	}
};

run();

app.listen(port, () => {
	console.log(`Listening to port ${port}`);
});
