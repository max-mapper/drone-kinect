var kinectBrowser = require('openni-browser')()
var kinectSock = kinectBrowser.sock
var skeleton = kinectBrowser.skeleton
var ecstatic = require('ecstatic')(__dirname + '/www')
var droneStream = require('dronestream')
var arDrone = require('ar-drone')
var drone = arDrone.createClient()
var events = require('events')
var server = require('http').createServer(ecstatic)
var spawn = require('child_process').spawn
var activeUser = false
var direction = "stop"
var lastLeft
var lastRight
var lastJointEventID
var jointCounter = 0

function resetLR() {
  console.log('resetting LR')
  lastLeft = 0
  lastRight = -1
}

resetLR()

function updateDirection() {
  if (lastLeft > 0 && lastRight > 0) {
    direction = "right"
  } else if (lastLeft < 0 && lastRight < 0) {
    direction = "left"
  } else {
    direction = "stop"
  }
  skeleton.emit('direction', direction)
}

function RunningAverage(num) {
  this.values = []
  this.max = num || 50
}

RunningAverage.prototype.write = function(num) {
  this.values.push(num)
  if (this.values.length > this.max) this.values.shift()
  this.updateAverage()
}

RunningAverage.prototype.updateAverage = function() {
  this.average = eval(this.values.join('+')) / this.values.length // lulz
}

function skeletonStats(joint) {
  var statsX = new RunningAverage()
  
  var xEvents = new events.EventEmitter()
  
  skeleton.on(joint, function(userId, x, y, z) {
    if (userId !== activeUser) {
      if (userId === lastJointEventID) {
        jointCounter++
        lastJointEventID = userId
      } else {
        lastJointEventID = userId
        jointCounter = 0
      }
      if (jointCounter > 25) {
        activeUser = userId
        skeleton.emit('activeuser', userId)
      } else {
        return console.log('joint event for ', userId, jointCounter, lastJointEventID, activeUser)
      }
    }
    statsX.write(x)
    xEvents.emit('data', ~~statsX.average)
  })
  
  return xEvents
}

skeleton.on('direction', function(direction) {
  if (direction === 'left') return drone.counterClockwise(0.5)
  if (direction === 'right') return drone.clockwise(0.5)
  if (direction === 'stop') return drone.stop()
  drone.stop()
})

skeleton.on('userexit', function(userId) {
  if (userId !== activeUser) return
  resetLR()
  skeleton.emit('lostuser', userId)
  console.log("DRONE LANDING")
  drone.land()
})

skeleton.on('lostuser', function(userId) {
  if (userId !== activeUser) return
  skeleton.emit('deactivate', userId)
  resetLR()
  activeUser = false
  skeleton.emit('activeuser', false)
  drone.land()
})

skeleton.on('calibrationsuccess', function(userId) {
  activeUser = userId
  skeleton.emit('activeuser', userId)
  console.log("DRONE TAKEOFF")
  drone.disableEmergency()
  drone.takeoff()
})

skeletonStats('right_hand').on('data', function(avg) {
  lastRight = avg
})

skeletonStats('left_hand').on('data', function(avg) {
  lastLeft = avg
  updateDirection()
})

function droneUpDown(dir) {
  drone[dir](0.5)
  drone[dir](0.5)
  drone[dir](0.5)
  setTimeout(function() {
    drone.stop() 
    drone.stop() 
    drone.stop() 
  }, 500)
}

skeleton.on('key', function(cmd) {
  if (cmd === "land") {
    drone.land()
    drone.land()
    drone.land()
    drone.land()
    drone.land()
    return
  }
  if (cmd === "takeoff") {
    drone.takeoff()
    drone.takeoff()
    drone.takeoff()
    drone.takeoff()
    drone.takeoff()
    return
  }
  if (cmd === "up") return droneUpDown('up')
  if (cmd === "down") return droneUpDown('down')
})

setInterval(function() {
  console.log("RH", lastRight, "LH", lastLeft)
}, 1000)

kinectSock.install(server, '/skeleton')
droneStream.listen(server)

server.listen(8080, function() {
  console.log('kinect socks server listening...')
  spawn('open', ['http://localhost:8080']);
})
