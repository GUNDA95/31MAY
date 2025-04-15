// Main game file using Three.js
// This is a simplified prototype that can be expanded

// Import libraries (these would need to be included in your HTML)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/simplex-noise@2.4.0/simplex-noise.min.js"></script>

// Game constants
const WORLD_SIZE = 100;
const CHUNK_SIZE = 16;
const BLOCK_SIZE = 1;
const RENDER_DISTANCE = 4;

// Game class
class OpenWorldGame {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x87CEEB); // Sky blue
    document.body.appendChild(this.renderer.domElement);
    
    this.setupLighting();
    this.setupControls();
    this.initWorld();
    this.createAirplane();
    
    window.addEventListener('resize', () => this.onWindowResize());
    
    this.animate();
  }
  
  setupLighting() {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
    this.scene.add(ambientLight);
    
    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 0.5).normalize();
    this.scene.add(directionalLight);
  }
  
  setupControls() {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.playerHeight = 1.8;
    
    // Set initial camera position
    this.camera.position.y = 30; // Start high to see the world
    this.camera.position.z = 5;
    
    // Set up keyboard controls
    document.addEventListener('keydown', (event) => this.onKeyDown(event));
    document.addEventListener('keyup', (event) => this.onKeyUp(event));
    
    // Mouse controls for looking around
    document.addEventListener('mousemove', (event) => this.onMouseMove(event));
    this.renderer.domElement.requestPointerLock = this.renderer.domElement.requestPointerLock || 
                                                  this.renderer.domElement.mozRequestPointerLock;
    
    this.renderer.domElement.addEventListener('click', () => {
      this.renderer.domElement.requestPointerLock();
    });
  }
  
  onKeyDown(event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = true;
        break;
      case 'Space':
        if (this.canJump) {
          this.velocity.y = 10;
          this.canJump = false;
        }
        break;
      case 'KeyF':
        // Interact with objects (like entering airplane)
        this.interactWithObjects();
        break;
    }
  }
  
  onKeyUp(event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = false;
        break;
    }
  }
  
  onMouseMove(event) {
    if (document.pointerLockElement === this.renderer.domElement) {
      const movementX = event.movementX || event.mozMovementX || 0;
      const movementY = event.movementY || event.mozMovementY || 0;
      
      // Rotate camera based on mouse movement
      this.camera.rotation.y -= movementX * 0.002;
      
      // Limit vertical camera rotation
      const verticalRotation = this.camera.rotation.x - movementY * 0.002;
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, verticalRotation));
    }
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  initWorld() {
    this.chunks = {};
    this.noise = new SimplexNoise();
    
    // Create ground
    this.generateTerrain();
    
    // Create a simple collision plane for now
    this.groundLevel = 0;
  }
  
  generateTerrain() {
    // Generate chunks around player
    const playerChunkX = Math.floor(this.camera.position.x / (CHUNK_SIZE * BLOCK_SIZE));
    const playerChunkZ = Math.floor(this.camera.position.z / (CHUNK_SIZE * BLOCK_SIZE));
    
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
      for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
        const chunkX = playerChunkX + x;
        const chunkZ = playerChunkZ + z;
        const chunkId = `${chunkX},${chunkZ}`;
        
        if (!this.chunks[chunkId]) {
          this.chunks[chunkId] = this.createChunk(chunkX, chunkZ);
        }
      }
    }
  }
  
  createChunk(chunkX, chunkZ) {
    const chunk = new THREE.Group();
    chunk.position.set(
      chunkX * CHUNK_SIZE * BLOCK_SIZE,
      0,
      chunkZ * CHUNK_SIZE * BLOCK_SIZE
    );
    
    // Create blocks for this chunk
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        
        // Generate height using noise
        const height = this.generateHeight(worldX, worldZ);
        
        // Create blocks from bedrock up to height
        for (let y = 0; y < height; y++) {
          let blockType;
          
          if (y === height - 1) {
            if (y > 12) blockType = 'stone';
            else if (y > 6) blockType = 'dirt';
            else blockType = 'sand';
          } else if (y > height - 4) {
            blockType = 'dirt';
          } else {
            blockType = 'stone';
          }
          
          this.createBlock(chunk, x, y, z, blockType);
        }
        
        // Add water for lower terrain
        if (height < 6) {
          for (let y = height; y < 6; y++) {
            this.createBlock(chunk, x, y, z, 'water');
          }
        }
        
        // Randomly add trees
        if (height > 6 && height < 12 && Math.random() < 0.01) {
          this.createTree(chunk, x, height, z);
        }
      }
    }
    
    this.scene.add(chunk);
    return chunk;
  }
  
  generateHeight(x, z) {
    // Generate terrain height using noise
    const scale1 = 0.01;
    const scale2 = 0.05;
    
    const noise1 = this.noise.noise2D(x * scale1, z * scale1);
    const noise2 = this.noise.noise2D(x * scale2, z * scale2);
    
    // Combine noise at different scales
    const combinedNoise = (noise1 + 0.5 * noise2) / 1.5;
    
    // Calculate final height
    return Math.floor(combinedNoise * 15) + 5;
  }
  
  createBlock(parent, x, y, z, type) {
    const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    let material;
    
    // Set material based on block type
    switch (type) {
      case 'grass':
        material = new THREE.MeshLambertMaterial({ color: 0x3bab17 });
        break;
      case 'dirt':
        material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        break;
      case 'stone':
        material = new THREE.MeshLambertMaterial({ color: 0x808080 });
        break;
      case 'sand':
        material = new THREE.MeshLambertMaterial({ color: 0xC2B280 });
        break;
      case 'water':
        material = new THREE.MeshLambertMaterial({ 
          color: 0x0077be,
          transparent: true,
          opacity: 0.7
        });
        break;
      case 'wood':
        material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        break;
      case 'leaves':
        material = new THREE.MeshLambertMaterial({ 
          color: 0x2E8B57,
          transparent: true,
          opacity: 0.8
        });
        break;
      default:
        material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    }
    
    const block = new THREE.Mesh(geometry, material);
    block.position.set(
      x * BLOCK_SIZE + BLOCK_SIZE/2,
      y * BLOCK_SIZE + BLOCK_SIZE/2,
      z * BLOCK_SIZE + BLOCK_SIZE/2
    );
    
    block.userData = { type };
    parent.add(block);
    return block;
  }
  
  createTree(chunk, x, y, z) {
    // Create trunk
    const trunkHeight = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < trunkHeight; i++) {
      this.createBlock(chunk, x, y + i, z, 'wood');
    }
    
    // Create leaves
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = 0; dy <= 2; dy++) {
          // Skip corners for a rounder shape
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          
          this.createBlock(
            chunk, 
            x + dx, 
            y + trunkHeight + dy, 
            z + dz, 
            'leaves'
          );
        }
      }
    }
    
    // Top leaves
    this.createBlock(chunk, x, y + trunkHeight + 3, z, 'leaves');
    this.createBlock(chunk, x + 1, y + trunkHeight + 3, z, 'leaves');
    this.createBlock(chunk, x - 1, y + trunkHeight + 3, z, 'leaves');
    this.createBlock(chunk, x, y + trunkHeight + 3, z + 1, 'leaves');
    this.createBlock(chunk, x, y + trunkHeight + 3, z - 1, 'leaves');
  }
  
  createAirplane() {
    // Create a simple airplane model
    this.airplane = new THREE.Group();
    
    // Fuselage
    const fuselageGeometry = new THREE.BoxGeometry(10, 2, 2);
    const fuselageMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    this.airplane.add(fuselage);
    
    // Wings
    const wingGeometry = new THREE.BoxGeometry(4, 0.5, 14);
    const wingMaterial = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.y = 0.5;
    this.airplane.add(wings);
    
    // Tail
    const tailGeometry = new THREE.BoxGeometry(1, 3, 3);
    const tailMaterial = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(-5, 1, 0);
    this.airplane.add(tail);
    
    // Propeller
    const propellerGeometry = new THREE.BoxGeometry(0.5, 0.2, 4);
    const propellerMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    this.propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
    this.propeller.position.set(5.25, 0, 0);
    this.airplane.add(this.propeller);
    
    // Create the gold ticket inside
    this.createGoldTicket();
    
    // Position airplane in the world
    this.airplane.position.set(20, 15, 30);
    this.scene.add(this.airplane);
    
    // Airplane physics properties
    this.airplanePhysics = {
      isPlayerInside: false,
      speed: 0,
      maxSpeed: 2,
      acceleration: 0.05,
      deceleration: 0.02,
      rotationSpeed: 0.02,
      liftFactor: 0.05,
      gravity: 0.1,
      isFlying: false
    };
  }
  
  createGoldTicket() {
    // Create the golden ticket with "31" inscription
    const ticketGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.8);
    const ticketMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    this.goldTicket = new THREE.Mesh(ticketGeometry, ticketMaterial);
    
    // Position the ticket inside the airplane
    this.goldTicket.position.set(0, 0.5, 0);
    this.goldTicket.rotation.x = Math.PI / 2;
    
    // Add text with "31"
    const textGeometry = new THREE.TextGeometry("31", {
      font: new THREE.Font(), // You'd need to load a font
      size: 0.2,
      height: 0.05
    });
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(-0.1, 0.2, 0);
    
    // In a real implementation, you'd load a font and add the text
    // For this prototype, we'll just add the ticket itself
    this.airplane.add(this.goldTicket);
    
    // The ticket is initially not visible/accessible to the player
    this.goldTicket.visible = false;
  }
  
  interactWithObjects() {
    // Check if player is near the airplane
    const distance = this.camera.position.distanceTo(this.airplane.position);
    
    if (distance < 5) {
      if (this.airplanePhysics.isPlayerInside) {
        // Exit airplane
        this.airplanePhysics.isPlayerInside = false;
        this.camera.position.y -= 2; // Move player below the airplane
      } else {
        // Enter airplane
        this.airplanePhysics.isPlayerInside = true;
        this.goldTicket.visible = true; // Show the gold ticket
        
        // Position player in cockpit
        this.camera.position.copy(this.airplane.position);
        this.camera.position.y += 2;
      }
    }
  }
  
  updatePlayerMovement(delta) {
    // Only update player movement if not in airplane
    if (this.airplanePhysics.isPlayerInside) return;
    
    // Apply gravity
    this.velocity.y -= 9.8 * delta;
    
    // Get movement direction
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();
    
    // Rotate movement direction based on camera rotation
    if (this.moveForward || this.moveBackward) {
      this.velocity.z = this.direction.z * 10.0 * delta;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x = this.direction.x * 10.0 * delta;
    }
    
    // Update camera position
    this.camera.position.x += this.velocity.x;
    this.camera.position.y += this.velocity.y * delta;
    this.camera.position.z += this.velocity.z;
    
    // Simple collision detection with ground
    if (this.camera.position.y < this.groundLevel + this.playerHeight) {
      this.velocity.y = 0;
      this.camera.position.y = this.groundLevel + this.playerHeight;
      this.canJump = true;
    }
  }
  
  updateAirplaneMovement(delta) {
    // Only update airplane if player is inside
    if (!this.airplanePhysics.isPlayerInside) return;
    
    // Rotate propeller when flying
    if (this.airplanePhysics.isFlying) {
      this.propeller.rotation.z += 0.5;
    }
    
    // Handle airplane controls
    if (this.moveForward) {
      // Accelerate
      this.airplanePhysics.speed = Math.min(
        this.airplanePhysics.maxSpeed,
        this.airplanePhysics.speed + this.airplanePhysics.acceleration * delta
      );
      this.airplanePhysics.isFlying = true;
    } else if (this.airplanePhysics.speed > 0) {
      // Decelerate
      this.airplanePhysics.speed = Math.max(
        0,
        this.airplanePhysics.speed - this.airplanePhysics.deceleration * delta
      );
      
      if (this.airplanePhysics.speed === 0) {
        this.airplanePhysics.isFlying = false;
      }
    }
    
    // Handle turning
    if (this.moveLeft) {
      this.airplane.rotation.y += this.airplanePhysics.rotationSpeed;
    }
    if (this.moveRight) {
      this.airplane.rotation.y -= this.airplanePhysics.rotationSpeed;
    }
    
    // Handle pitch (up/down)
    if (this.moveBackward) {
      // Pitch up
      this.airplane.rotation.x = Math.min(
        Math.PI / 6,
        this.airplane.rotation.x + 0.01
      );
    } else if (this.moveForward && this.airplanePhysics.isFlying) {
      // Pitch down slightly when accelerating
      this.airplane.rotation.x = Math.max(
        -Math.PI / 12,
        this.airplane.rotation.x - 0.005
      );
    } else {
      // Level out
      this.airplane.rotation.x *= 0.95;
    }
    
    // Calculate direction based on airplane's rotation
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.airplane.quaternion);
    direction.normalize();
    
    // Move airplane based on speed and direction
    this.airplane.position.addScaledVector(direction, this.airplanePhysics.speed);
    
    // Apply lift based on speed
    if (this.airplanePhysics.isFlying) {
      const lift = this.airplanePhysics.speed * this.airplanePhysics.liftFactor;
      this.airplane.position.y += lift;
    } else {
      // Apply gravity when not flying
      this.airplane.position.y = Math.max(
        10, // Minimum height
        this.airplane.position.y - this.airplanePhysics.gravity
      );
    }
    
    // Update camera position to follow airplane
    this.camera.position.copy(this.airplane.position);
    this.camera.position.y += 2; // Position camera in cockpit
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = 0.1; // Fixed delta for simplified physics
    
    // Update movement
    if (this.airplanePhysics.isPlayerInside) {
      this.updateAirplaneMovement(delta);
    } else {
      this.updatePlayerMovement(delta);
    }
    
    // Update terrain if player moved to new chunk
    this.generateTerrain();
    
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const game = new OpenWorldGame();
});
