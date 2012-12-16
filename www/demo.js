(function() {
  var events = require('events')
  var directionEl = document.querySelector('.direction h1')  
  var statusEl = document.querySelector('.status h1')  
  var jointNames = [
    "head",
    "neck",
    "torso",
    "waist",
    "left_collar",
    "left_shoulder",
    "left_elbow",
    "left_wrist",
    "left_hand",
    "left_fingertip",
    "right_collar",
    "right_shoulder",
    "right_elbow",
    "right_wrist",
    "right_hand",
    "right_fingertip",
    "left_hip",
    "left_knee",
    "left_ankle",
    "left_foot",
    "right_hip",
    "right_knee",
    "right_ankle",
    "right_foot"  
  ];

  //// Connect to skeleton server
  window.kinect = openni('/skeleton');

  kinect.on('direction', function(direction) {
    directionEl.innerHTML = direction
  })
  
  //// Initialize Scene

  var world = (function() {

    console.log('Initializing world...');

    var camera = new THREE.PerspectiveCamera(
          35, window.innerWidth / window.innerHeight, 1, 8000 );
        camera.position.x = 2000;
        camera.position.y = 1000;
        camera.position.z = 7000;

    var scene = new THREE.Scene();
    //scene.fog = new THREE.Fog(0x000000, 1500, 4000);

    var renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight - 100);

    $("#container").append(renderer.domElement);

    camera.lookAt(scene.position);

    return {
      scene: scene
    , camera: camera
    , renderer: renderer
    };

  }());

  var scene = world.scene;
  var camera = world.camera;
  var renderer = world.renderer;

  //// Track here which users are in the scene
  window.users = {};

  //// Initialize new users
  kinect.on('calibrationsuccess', function(userId) {

    console.log('newuser', userId);
    if (! users[userId]) {

      var material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: false } );
      var geometry = new THREE.SphereGeometry( 20 );

      var user = {};
      jointNames.forEach(function(jointName) {
        var joint = new THREE.Mesh( geometry, material );
        user[jointName] = joint;
        scene.add(joint);
      });
      users[userId] = user;
    }
  });
  
  //// Remove lost users
  kinect.on('lostuser', function(userId) {
    var user = users[userId];
    if (user) {
      var joints = Object.keys(user);
      joints.forEach(function(jointName) {
        scene.remove(user[jointName]);
      });
      delete users[userId];
    }
  });

  //// Update users joints
  jointNames.forEach(function(jointName) {
    kinect.on(jointName, function(userId, x, y, z) {
      var user = users[userId];
      if (!user) return;
      var joint = user[jointName]
      if (joint) {
        joint = joint.position;
        joint.x = x;
        joint.y = y;
        joint.z = z;
      }
    });
  });

  [
    'posedetected',
    'calibrationstart',
    'calibrationsuccess',
    'calibrationfail'
  ].forEach(function(userEventType) {
    kinect.on(userEventType, function(userId) {
      statusEl.innerHTML = "user " + userId + ": " + userEventType
    });
  });

  function animate() {
     requestAnimationFrame(animate);
     render();
  }

  function render() {
    renderer.render(scene, camera);
  }

  animate();

  window.onkeydown = function( e ) {
    if (e.keyCode === 38) return kinect.jsonWriteStream.write(['key', 'up'])
    if (e.keyCode === 40) return kinect.jsonWriteStream.write(['key', 'down'])
    if (e.keyCode === 13) return kinect.jsonWriteStream.write(['key', 'land'])
    if (e.keyCode === 32) return kinect.jsonWriteStream.write(['key', 'takeoff'])
  }

}());