// Game constants
const WORLD_SIZE = 100;
const CHUNK_SIZE = 16;
const BLOCK_SIZE = 1;
const RENDER_DISTANCE = 2; // Ridotto per migliori prestazioni

// Game class
class OpenWorldGame {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x87CEEB); // Sky blue
    document.body.appendChild(this.renderer.domElement);
    
    // Rimuovi il messaggio di caricamento
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
      loadingMessage.style.display = 'none';
    }
    
    this.setupLighting();
    this.setupControls();
    this.initWorld();
    this.createAirplane();
    
    window.addEventListener('resize', () => this.onWindowResize());
    
    // Debug log
    console.log("Game initialized");
    
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
    
    // Crea un terreno più semplice per migliorare le prestazioni
    const geometry = new THREE.PlaneGeometry(
      CHUNK_SIZE * BLOCK_SIZE,
      CHUNK_SIZE * BLOCK_SIZE,
      CHUNK_SIZE - 1,
      CHUNK_SIZE - 1
    );
    geometry.rotateX(-Math.PI / 2);
    
    // Imposta l'altezza dei vertici in base al rumore
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i] + chunk.position.x;
      const z = vertices[i + 2] + chunk.position.z;
      vertices[i + 1] = this.generateHeight(x / BLOCK_SIZE, z / BLOCK_SIZE);
    }
    
    // Aggiorna la geometria
    geometry.computeVertexNormals();
    
    // Crea un materiale per il terreno
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x8B4513,
      wireframe: false
    });
    
    const terrain = new THREE.Mesh(geometry, material);
    chunk.add(terrain);
    
    // Aggiungi alcuni alberi
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(Math.random() * CHUNK_SIZE);
      const z = Math.floor(Math.random() * CHUNK_SIZE);
      const worldX = chunkX * CHUNK_SIZE + x;
      const worldZ = chunkZ * CHUNK_SIZE + z;
      const y = this.generateHeight(worldX, worldZ);
      
      this.createTree(chunk, x, y, z);
    }
    
    this.scene.add(chunk);
    return chunk;
  }
  
  generateHeight(x, z) {
    // Usa una funzione più semplice per la generazione dell'altezza
    const scale1 = 0.01;
    const scale2 = 0.05;
    
    const noise1 = this.noise.noise2D(x * scale1, z * scale1);
    const noise2 = this.noise.noise2D(x * scale2, z * scale2);
    
    // Combina il rumore a scale diverse
    const combinedNoise = (noise1 + 0.5 * noise2) / 1.5;
    
    // Calcola l'altezza finale
    return Math.floor(combinedNoise * 10) + 5;
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
    // Tronco
    const trunkGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE * 4, BLOCK_SIZE);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(
      x * BLOCK_SIZE,
      y + (BLOCK_SIZE * 2),
      z * BLOCK_SIZE
    );
    chunk.add(trunk);
    
    // Foglie
    const leavesGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 3, BLOCK_SIZE * 3, BLOCK_SIZE * 3);
    const leavesMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x2E8B57,
      transparent: true,
      opacity: 0.8
    });
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.set(
      x * BLOCK_SIZE,
      y + (BLOCK_SIZE * 5),
      z * BLOCK_SIZE
    );
    chunk.add(leaves);
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
    
    // Semplice testo "31"
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
    // Box per il numero "3"
    const number3Geometry = new THREE.BoxGeometry(0.15, 0.05, 0.05);
    const number3 = new THREE.Mesh(number3Geometry, textMaterial);
    number3.position.set(-0.1, 0.16, 0);
    this.goldTicket.add(number3);
    
    // Box per il numero "1"
    const number1Geometry = new THREE.BoxGeometry(0.05, 0.15, 0.05);
    const number1 = new THREE.Mesh(number1Geometry, textMaterial);
    number1.position.set(0.1, 0.16, 0);
    this.goldTicket.add(number1);
    
    // Aggiungi il biglietto all'aereo
    this.airplane.add(this.goldTicket);
    
    // Il biglietto è inizialmente invisibile
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
      
      console.log("Interagito con l'aereo", this.airplanePhysics.isPlayerInside ? "Entrato" : "Uscito");
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
  console.log("Game started");
});
