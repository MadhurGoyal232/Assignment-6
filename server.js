/*********************************************************************************
*  WEB322 – Assignment 06
*  I declare that this assignment is my own work in accordance with Seneca  Academic Policy.  No part of this
*  assignment has been copied manually or electronically from any other source (including web sites) or 
*  distributed to other students.
* 
*  Name: Madhur Goyal
*  Student ID: 155880214 
*  Date:  4 APRIL 2023
*
*  Online (Cyclic) Link: 
*
********************************************************************************/ 

const express = require("express");
const path = require("path");
const data = require("./data-service.js");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const dataServiceAuth = require("./data-service-auth");
const dataService = require("./data-service");
const clientSessions = require('client-sessions');

const exphbs = require('express-handlebars');

const app = express();
const HTTP_PORT = process.env.PORT || 8080;

cloudinary.config({
    cloud_name: 'dp0cdwjfg',
    api_key: '464917171124998',
    api_secret: 'CrLvMl5Hb2qtk4iPskc-pKVVFUU',
    secure: true
});

app.use(clientSessions({
    cookieName: 'session',
    secret: 'web_assignment6', 
    duration: 24 * 60 * 60 * 1000, 
    activeDuration: 1000 * 60 * 5 
  }));
  
  app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
  });

  function ensureLogin(req, res, next) {
    if (req.session.userName) {
      res.redirect('/login');
      console.log('bad bad something wrong here...')
    } else {
      next();
    }
  }

app.engine('.hbs', exphbs.engine({ 
    extname: '.hbs',
    defaultLayout: "main",
    helpers: { 
        navLink: function(url, options){
            return '<li' + 
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') + 
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        }
    } 
}));

app.set('view engine', '.hbs');

const upload = multer(); 

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(function(req,res,next){
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = (route == "/") ? "/" : route.replace(/\/$/, "");
    next();
});

app.get("/", (req,res) => {
    res.render("home");
});

app.get("/about", (req,res) => {
    res.render("about");
});

app.get("/login", (req, res) => {
    res.render(path.join(__dirname, "/views/login.hbs"));
  });

app.get("/register", (req, res) => {
    res.render(path.join(__dirname, "/views/register.hbs"));
  });
  
  app.post('/register', function(req, res) {
    dataServiceAuth.registerUser(req.body)
      .then(() => {
        res.render('register', {successMessage: 'User created'});
      })
      .catch((err) => {
        res.render('register', {errorMessage: err, userName: req.body.userName});
      });
  });
  
  app.post('/login', function(req, res) {
    req.body.userAgent = req.get('User-Agent');
    dataServiceAuth.checkUser(req.body)
      .then(function(user) {
        req.session.user = {
          userName: user.userName,
          email: user.email,
          loginHistory: user.loginHistory
        };
        console.log('Login successful')
        res.redirect('/students');
      })
      .catch(function(err) {
        res.render('login', {
          errorMessage: err,
          userName: req.body.userName
        });
      });
  });
  app.get('/logout', function(req, res) {
    req.session.reset();
    res.redirect('/');
  });

  app.get('/userHistory',ensureLogin , function(req, res) {
    res.render('userHistory');
  });


app.get("/students/add",ensureLogin, (req,res) => {
    data.getPrograms().then((data)=>{
        res.render("addStudent", {programs: data});
    }).catch((err) => {
        res.render("addStudent", {programs: [] });
    });
});

app.post("/students/add",ensureLogin, (req, res) => {
    data.addStudent(req.body).then(()=>{
      res.redirect("/students"); 
    }).catch((err)=>{ 
        res.status(500).send("Unable to Add the Student");
    }); 
});



app.get("/students",ensureLogin, (req, res) => {
    
    if (req.query.status) {
         data.getStudentsByStatus(req.query.status).then((data) => {
             res.render("students", {students:data});
         }).catch((err) => {
             res.render("students",{ message: "no results" });
         });
     } else if (req.query.program) {
         data.getStudentsByProgramCode(req.query.program).then((data) => {
             res.render("students", {students:data});
         }).catch((err) => {
             res.render("students",{ message: "no results" });
         });
     } else if (req.query.credential) {
         data.getStudentsByExpectedCredential(req.query.credential).then((data) => {
             res.render("students", {students:data});
         }).catch((err) => {
             res.render("students",{ message: "no results" });
         });
     } else {
         data.getAllStudents().then((data) => {
             res.render("students", {students:data});
         }).catch((err) => {
             res.render("students",{ message: "no results" });
         });
     }
});

app.get("/student/:studentId",ensureLogin, (req, res) => {
    let viewData = {};

    data.getStudentById(req.params.studentId).then((data) => {
        if (data) {
            viewData.student = data; 
        } else {
            viewData.student = null; 
        }
    }).catch(() => {
        viewData.student = null; 
    }).then(data.getPrograms)
    .then((data) => {
        viewData.programs = data; 

        for (let i = 0; i < viewData.programs.length; i++) {
            if (viewData.programs[i].programCode == viewData.student.program) {
                viewData.programs[i].selected = true;
            }
        }

    }).catch(() => {
        viewData.programs = []; 
    }).then(() => {
        if (viewData.student == null) { 
            res.status(404).send("Student Not Found");
        } else {
            res.render("student", { viewData: viewData }); 
        }
    }).catch((err)=>{
        res.status(500).send("Unable to Show Students");
      });
});

app.get("/intlstudents",ensureLogin, (req,res) => {
    data.getInternationalStudents().then((data)=>{
        res.json(data);
    });
});

app.post("/student/update",ensureLogin, (req, res) => {
    data.updateStudent(req.body).then(()=>{
    res.redirect("/students");
  }).catch((err)=>{ 
    res.status(500).send("Unable to Update the Student");
  });
});

app.get("/students/delete/:sid",ensureLogin, (req,res)=>{ 
    data.deleteStudentById(req.params.sid).then(()=>{
        res.redirect("/students");
    }).catch((err)=>{
        res.status(500).send("Unable to Remove Student / Student Not Found");
    });
});


app.get("/images/add",ensureLogin, (req,res) => {
    res.render("addImage");
});

app.post("/images/add",ensureLogin, upload.single("imageFile"), (req,res) =>{
    if(req.file){
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );
    
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };
    
        async function upload(req) {
            let result = await streamUpload(req);
            return result;
        }
    
        upload(req).then((uploaded)=>{
            processForm(uploaded); 
        });
    }else{
        processForm("");
    }

    function processForm(uploaded){ 
        
        imageData = {};
        imageData.imageID = uploaded.public_id;
        imageData.imageUrl = uploaded.url;
        imageData.version = uploaded.version;
        imageData.width = uploaded.width;
        imageData.height = uploaded.height;
        imageData.format = uploaded.format;
        imageData.resourceType = uploaded.resource_type;
        imageData.uploadedAt = uploaded.created_at;
        imageData.originalFileName = req.file.originalname;
        imageData.mimeType = req.file.mimetype;

        data.addImage(imageData).then(()=>{ 
            res.redirect("/images");
        }).catch(err=>{
            res.status(500).send(err);
        })
    }  

   
});



app.get("/images",ensureLogin, (req,res) => {

    data.getImages().then((data) => {
        res.render("images",{images: data});  
    }).catch((err) => {
        res.render("images",{ message: "no results" });
    });
});


app.get("/programs/add",ensureLogin, (req,res) => { 
    res.render("addProgram");
});
  
app.post("/programs/add",ensureLogin, (req, res) => { 
    data.addProgram(req.body).then(()=>{
        res.redirect("/programs");
    }).catch((err)=>{
        res.status(500).send("Unable to Add the Program");
    });
});
  
app.get("/programs",ensureLogin, (req,res) => {
    data.getPrograms().then((data)=>{
        res.render("programs", (data.length > 0) ? {programs:data} : { message: "no results" });
    }).catch((err) => {
        res.render("programs",{message:"no results"});
    });
});

app.get("/program/:programCode",ensureLogin, (req, res) => { 
    data.getProgramByCode(req.params.programCode).then((data) => {
        if(data){
            res.render("program", { data: data });
        }else{
            res.status(404).send("Program Not Found");
        }
     
    }).catch((err) => {
        res.status(404).send("Program Not Found");
    });
});

app.post("/program/update",ensureLogin, (req, res) => { 
    data.updateProgram(req.body).then(()=>{
        res.redirect("/programs");
    }).catch((err)=>{
        res.status(500).send("Unable to Update the Program");
    });
});

app.get("/programs/delete/:programCode",ensureLogin, (req,res)=>{
    data.deleteProgramByCode (req.params.programCode).then(()=>{
        res.redirect("/programs");
    }).catch((err)=>{
        res.status(500).send("Unable to Remove Program / Program Not Found");
    });
});



app.use((req, res) => {
    res.status(404).send("Page Not Found");
});



dataService.initialize()
.then(dataServiceAuth.initialize)
.then(function(){
    app.listen(HTTP_PORT, function(){
        console.log("app listening on: " + HTTP_PORT)
    });
}).catch(function(err){
    console.log("unable to start server: " + err);
});