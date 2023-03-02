const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

const mongooose = require('mongoose');
let bodyParser = require('body-parser');

app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({extended:false}))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

mongooose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
},()=>{
  console.log('connection reussie');
})

const UserSchema = new mongooose.Schema({
  username: String
})

const ExerciseSchema = new mongooose.Schema({
  userId: { type: String, required: true },
  description: String,
  duration: Number,
  date:{type: Date, default: Date.now()},
});

const User = mongooose.model("UsersCertification",UserSchema)
const Exercise = mongooose.model("ExerciseCertification",ExerciseSchema)

let date = new Date()
var dateString = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();
console.log("date du jour "+dateString)

app.post('/api/users', (req, res) => {
  var user = new User({username: req.body.username});
  user.save((err, data) => {
    if (err) {
      res.json("user do not create ")
    }else{
      res.json({
        "username": data.username,
        "_id": data.id
      })
    }
  })
})

app.get('/api/users', (req, res) => {
  User.find({}, (err, data) => {
    if(err) res.json(err);
    else res.json(data)
  })
});

app.post('/api/users/:_id/exercises', function (req, res) {
	if (req.params._id === '0') {
		return res.json({ error: '_id is required' });
	}

	if (req.body.description === '') {
		return res.json({ error: 'description is required' });
	}

	if (req.body.duration === '') {
		return res.json({ error: 'duration is required' });
	}

	let userId = req.params._id;
	let description = req.body.description;
	let duration = parseInt(req.body.duration);
	let date = (req.body.date !== undefined ? new Date(req.body.date) : new Date());

	if (isNaN(duration)) {
		return res.json({ error: 'duration is not a number' });
	}

	if (date == 'Invalid Date') {
		return res.json({ error: 'date is invalid' });
	}

	User.findById(userId, function (err, data) {
		if (!err && data !== null) {
			let newExercise = new Exercise({
				userId: userId,
				description: description,
				duration: duration,
				date: date
			});

			newExercise.save(function (err2, data2) {
				if (!err2) {
					return res.json({
						_id: data['_id'],
						username: data['username'],
						description: data2['description'],
						duration: data2['duration'],
						date: new Date(data2['date']).toDateString()
					});
				}
			});
		} else {
			return res.json({ error: 'user not found' });
		}
	});
});



app.get('/api/users/:_id/exercises', function (req, res) {
	res.redirect('/api/users/' + req.params._id + '/logs');
});

app.get('/api/users/:_id/logs', function (req, res) {
	let userId = req.params._id;
	let findConditions = { userId: userId };

	if (
		(req.query.from !== undefined && req.query.from !== '')
		||
		(req.query.to !== undefined && req.query.to !== '')
	) {
		findConditions.date = {};

		if (req.query.from !== undefined && req.query.from !== '') {
			findConditions.date.$gte = new Date(req.query.from);
		}

		if (findConditions.date.$gte == 'Invalid Date') {
			return res.json({ error: 'from date is invalid' });
		}

		if (req.query.to !== undefined && req.query.to !== '') {
			findConditions.date.$lte = new Date(req.query.to);
		}

		if (findConditions.date.$lte == 'Invalid Date') {
			return res.json({ error: 'to date is invalid' });
		}
	}

	let limit = (req.query.limit !== undefined ? parseInt(req.query.limit) : 0);

	if (isNaN(limit)) {
		return res.json({ error: 'limit is not a number' });
	}

	User.findById(userId, function (err, data) {
		if (!err && data !== null) {
			Exercise.find(findConditions).sort({ date: 'asc' }).limit(limit).exec(function (err2, data2) {
				if (!err2) {
					return res.json({
						_id: data['_id'],
						username: data['username'],
						log: data2.map(function (e) {
							return {
								description: e.description,
								duration: e.duration,
								date: new Date(e.date).toDateString()
							};
						}),
						count: data2.length
					});
				}
			});
		} else {
			return res.json({ error: 'user not found' });
		}
	});
});

// Not found middleware
app.use((req, res, next) => {
	return next({ status: 404, message: 'not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
	let errCode, errMessage;

	if (err.errors) {
		// mongoose validation error
		errCode = 400; // bad request
		const keys = Object.keys(err.errors);
		// report the first validation error
		errMessage = err.errors[keys[0]].message;
	} else {
		// generic or custom error
		errCode = err.status || 500;
		errMessage = err.message || 'Internal Server Error';
	}

	res.status(errCode).type('txt')
		.send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
