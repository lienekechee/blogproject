const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const session = require('express-session')
const Sequelize = require('sequelize')
const bcrypt = require('bcrypt')
// const bootstrap = require('bootstrap')


const database = new Sequelize('blog_project', process.env.POSTGRES_USER, null, {
	host: 'localhost',
	dialect: 'postgres'
});

const app = express();

app.set('views', './views')
app.set('view engine', 'pug')

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
	console.log (__dirname)

app.use(session({
  secret: "Your secret key",
  resave: true,
saveUninitialized: false
}))

//DEFINITION OF TABLES
var User = database.define ('users', {
	username: {
		type: Sequelize.STRING,
		unique: true,

	},
	email: {
		type: Sequelize.STRING,
		unique: true
	},
	password: {
		type: Sequelize.STRING,
	}
},{
	timestamps:false
});

var Post = database.define('posts', {
	subject: {
		type: Sequelize.STRING
	},
	body: {
		type: Sequelize.TEXT
	}
	},{
	timestamps:false

}); 

var Comment = database.define('comments', {
	content: {
		type: Sequelize.TEXT
	}
},{
	timestamps:false

});

//RELATIONSHIPS

User.hasMany(Post);
User.hasMany(Comment);
Post.hasMany(Comment);

Post.belongsTo(User);
Comment.belongsTo(User);
Comment.belongsTo(Post);

database.sync() //{force: true}




//ROUTES

//1. GET REQUEST - INDEX (registration form, logIn)

app.get('/', function (req, res){
	res.render ('index', {
		message: req.query.message,
		user: req.session.user
	})
});

//GET REQUEST - REGISTER FORM

app.get('/registerform', (req, res) => {
	res.render ('register')
})

//2. POST REQUEST - CREATE A NEW PROFILE

app.post('/register', (req, res) => {

var password = req.body.passwordNew					//password from user registration form
var confirmPassword = req.body.confirmPassword

	if(password === confirmPassword){
		bcrypt.hash(password, 8, function (err, hash){	//password, hashed 8 times, callback 
			if (err !== undefined){
				console.log(err);
			} else {
				User.create({							//hashed password entered into database
					username: req.body.usernameNew,
					email: req.body.emailNew,
					password: hash
				}).then(function(){
					res.redirect('/')
				}).catch(error =>{						//
					console.error(error)
				})
			}
		})
	}else{
		res.redirect('/?message=' + encodeURIComponent("Please confirm password"));
	}
	
})

//2.5 POST REQUEST - LOGIN

app.post('/login',(req, res) => {

	var email = req.body.email
	var password = req.body.password

	User.findOne({
		where: {
			email: email
		}
	})
	.then(user => {

		bcrypt.compare(password, user.password, function (err, result){
			if (err !== undefined){
				console.log(err);
				res.redirect('/?message=' + encodeURIComponent("Invalid email or password."));
			} else {
				req.session.user = user;
				res.redirect('/profile');
			}
		})
	})
	.catch(error => {
		console.error(error)
		res.redirect('/?message=' + encodeURIComponent("Invalid email or password."));
	})

})

//GET REQUEST - RETRIEVE EXISTING PROFILE (INFO, DISPLAYS ALL BLOG POSTS by user - PROFILE.PUG)

app.get('/profile', (req, res) => {
    
    var user = req.session.user

	if (user) {
		Post.findAll({
			where: {
			    userId: req.session.user.id
			},
			order:[
				['id', 'DESC']
			],
		})
		.then(posts => {
			res.render('profile', {
				user:user, 
				posts:posts
			})
		})
	} else{
		res.redirect('/?message='+ encodeURIComponent("Please log in!"));
	}
	
});


//POST REQUEST - ADD NEW POST TO DATABASE - REDIRECT TO UPDATED PROFILE

app.post('/postMsg', (req, res) => {

	var user = req.session.user

	User.findOne({
		where: {
			id: user.id
		}
	})
	.then(user => {
		return user.createPost({
			subject: req.body.msgSubject,
			body: req.body.msgBody
		})
	})
	.then(post => {
		res.redirect('/profile')
	})
});


//POST REQUEST - COMMENT ON A POST

app.post('/comment', (req, res) => {
	
	var user = req.session.user
	const newComment = req.body.comment
	
	// console.log(newComment)
	// console.log(req.body.commentPostId)
	
	Comment.create ({
		content: newComment,
		userId: req.session.user.id,
		postId: req.body.commentPostId
	})
	.then(comment =>{

		res.redirect(`/post/${comment.postId}`)
	})

});


//6. GET REQUEST - RETRIEVE A PAGE WITH ALL POSTS FROM ALL USERS

app.get('/feed', (req, res) => {

var user = req.session.user

	Post.findAll({
		include:[{
			model: User
		}],
		order:[
			['id', 'DESC']
		]
	})
	.then((posts) => {
		// console.log(posts);
		// console.log("Is this anywhereeeeee "+posts[0].user.username);
		res.render('feed', {
			posts: posts,
			user: user
		});
	});
});


//POST REQUEST - POST SEARCH QUERY AGAINST DATABASE, PASS ON RESULT (POST ID)


app.post('/searchPost', (req, res) => {

	Post.findOne({
		where: {
			subject: req.body.search
		}
	})
	.then(post => {
		res.redirect(`/post/${post.id}`)
	})

	
})

//POST REQUEST - POST INFO FROM LINK IN FEED AGAINST DATABASE, PASS ON RESULT

app.post ('/postviaLink', (req, res) => {
	
	Post.findOne({
		where: {
			id: req.body.postLink
		}
	})
	.then(post => {
		res.redirect(`/post/${post.id}`)
	})
})

//7. GET REQUEST - RETRIEVE A PARTICULAR POST BY SEARCHING FOR ID - RENDER BLOG POST

app.get('/post/:postId', function(req, res){

	const postId = req.params.postId;	//this carries the values pointing to specific postIDs from the 2 post reqs above

	Post.findOne({
		where: {
			id: postId
		}
		
	})

	.then(post => {
		// console.log(post)
	Comment.findAll({
		where: {
			postId: post.id
		},
		include: [{
			model: User
		}],
		order:[
			['id', 'DESC']
		]
	})

	.then(comment => {
	User.findOne({
		where: {
			id: post.userId
		}
	})
	.then(user =>{
				
		res.render('post', {
			post:post, 
			comments: comment, 
			user:user
		});
			})
		})
	})
});


// GET REQUEST - LOG OUT

app.get('/logout', (req, res) => {
	req.session.destroy(error => {
		if(error) {
			throw error;
		}
		res.redirect('/?message=' + encodeURIComponent("Successfully logged out."));
	})
});


app.listen(3000, function(){
	console.log("Listening on port 3000")
})
