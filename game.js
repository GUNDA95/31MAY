// Game constants
const WORLD_SIZE = 100;
const CHUNK_SIZE = 16;
const BLOCK_SIZE = 1;
const RENDER_DISTANCE = 2;

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
    
    // Inizializza le variabili di movimento
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isMoving = false;
    
    this.setupLighting();
    this.setupControls();
    this.initWorld();
    this.createAirplane();
    
    // Posiziona correttamente il giocatore sopra il terreno
    this.camera.position.set(0, 15, 0); // Inizia da un'altezza sicura
    
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
    this.canJump = false;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.playerHeight = 1.8;
    
    // Set up keyboard controls with proper release handling
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
    
    // Crea un terreno di base solido
    this.createBaseTerrain();
    
    // Imposta una altezza di riferimento per la collisione con il terreno
    this.groundLevel = 0;
  }
  
  createBaseTerrain() {
    // Crea un terreno di base grande e piatto
    const baseGeometry = new THREE.PlaneGeometry(500, 500, 50, 50);
    baseGeometry.rotateX(-Math.PI / 2);
    
    // Applica una leggera variazione d'altezza
    const vertices = baseGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const z = vertices[i + 2];
      vertices[i + 1] = this.generateHeight(x, z);
    }
    
    // Aggiorna la geometria
    baseGeometry.computeVertexNormals();
    
    // Crea un materiale per il terreno con texture
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x8B4513,
      wireframe: false
    });
    
    const baseTerrain = new THREE.Mesh(baseGeometry, material);
    this.scene.add(baseTerrain);
    
    // Aggiungi alberi e dettagli al terreno
    this.addTerrainDetails();
  }
  
  addTerrainDetails() {
    // Aggiungi alberi al mondo
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 100 - 50;
      const z = Math.random() * 100 - 50;
      const y = this.generateHeight(x, z);
      this.createTree(x, y, z);
    }
    
    // Aggiunge una "skybox" per creare un orizzonte
    this.createSkybox();
  }
  
  createSkybox() {
    // Crea un semplice cielo sferico
    const skyGeometry = new THREE.SphereGeometry(400, 32, 32);
    // Inverti le normali per vedere il cielo dall'interno
    skyGeometry.scale(-1, 1, 1);
    
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87CEEB
    });
    
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(sky);
  }
  
  generateHeight(x, z) {
    // Usa una funzione più semplice per la generazione dell'altezza
    const scale1 = 0.01;
    const scale2 = 0.05;
    
    const noise1 = this.noise.noise2D(x * scale1, z * scale1);
    const noise2 = this.noise.noise2D(x * scale2, z * scale2);
    
    // Combina il rumore a scale diverse
    const combinedNoise = (noise1 + 0.5 * noise2) / 1.5;
    
    // Calcola l'altezza finale (meno estrema)
    return combinedNoise * 5;
  }
  
  createTree(x, y, z) {
    // Crea un gruppo per l'albero
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    
    // Tronco
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 4, 8);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2;
    tree.add(trunk);
    
    // Foglie (cima dell'albero)
    const leavesGeometry = new THREE.ConeGeometry(2, 4, 8);
    const leavesMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x2E8B57,
    });
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.y = 5.5;
    tree.add(leaves);
    
    this.scene.add(tree);
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
        console.log("Uscito dall'aereo");
      } else {
        // Enter airplane
        this.airplanePhysics.isPlayerInside = true;
        this.goldTicket.visible = true; // Show the gold ticket
        
        // Position player in cockpit
        this.camera.position.copy(this.airplane.position);
        this.camera.position.y += 2;
        console.log("Entrato nell'aereo");
      }
    } else {
      console.log("Non sei abbastanza vicino all'aereo");
    }
  }
  
  // Corretta gestione del movimento del giocatore
  updatePlayerMovement(delta) {
    // Only update player movement if not in airplane
    if (this.airplanePhysics.isPlayerInside) return;
    
    // Apply gravity
    this.velocity.y -= 9.8 * delta;
    
    // Reset movement velocity every frame
    this.velocity.x = 0;
    this.velocity.z = 0;
    
    // Get movement direction based on current key states
    if (this.moveForward) this.velocity.z = -1;
    if (this.moveBackward) this.velocity.z = 1;
    if (this.moveLeft) this.velocity.x = -1;
    if (this.moveRight) this.velocity.x = 1;
    
    // Normalize diagonal movement
    if (this.velocity.x !== 0 && this.velocity.z !== 0) {
      this.velocity.x *= 0.7071; // 1 / sqrt(2)
      this.velocity.z *= 0.7071;
    }
    
    // Convert camera direction to movement direction
    if (this.velocity.x !== 0 || this.velocity.z !== 0) {
      // Adjust velocity based on camera rotation
      const angle = this.camera.rotation.y;
      const newX = this.velocity.x * Math.cos(angle) + this.velocity.z * Math.sin(angle);
      const newZ = this.velocity.z * Math.cos(angle) - this.velocity.x * Math.sin(angle);
      this.velocity.x = newX;
      this.velocity.z = newZ;
      
      // Apply speed
      const moveSpeed = 10.0 * delta;
      this.velocity.x *= moveSpeed;
      this.velocity.z *= moveSpeed;
    }
    
    // Update camera position
    this.camera.position.x += this.velocity.x;
    this.camera.position.y += this.velocity.y * delta;
    this.camera.position.z += this.velocity.z;
    
    // Simple collision detection with ground
    // Trova l'altezza del terreno alla posizione del giocatore
    const terrainHeight = this.generateHeight(this.camera.position.x, this.camera.position.z) + this.playerHeight;
    
    if (this.camera.position.y < terrainHeight) {
      this.velocity.y = 0;
      this.camera.position.y = terrainHeight;
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
    
    // Reset airplane velocity
    let speed = 0;
    let turning = 0;
    let pitching = 0;
    
    // Handle airplane controls
    if (this.moveForward) {
      // Accelerate
      this.airplanePhysics.speed = Math.min(
        this.airplanePhysics.maxSpeed,
        this.airplanePhysics.speed + this.airplanePhysics.acceleration * delta
      );
      this.airplanePhysics.isFlying = true;
      pitching = -0.01; // Pitch down slightly
    } else if (this.moveBackward) {
      // Pitch up
      pitching = 0.01;
    } else if (this.airplanePhysics.speed > 0) {
      // Decelerate when no keys pressed
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
      turning = this.airplanePhysics.rotationSpeed;
    }
    if (this.moveRight) {
      turning = -this.airplanePhysics.rotationSpeed;
    }
    
    // Apply rotation
    this.airplane.rotation.y += turning;
    
    // Handle pitch (up/down) with limits
    this.airplane.rotation.x = Math.max(
      -Math.PI / 6,
      Math.min(Math.PI / 6, this.airplane.rotation.x + pitching)
    );
    
    // Level out gradually if not pitching
    if (!this.moveForward && !this.moveBackward) {
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
    
    // Match camera rotation to airplane direction
    this.camera.rotation.y = this.airplane.rotation.y;
    this.camera.rotation.z = this.airplane.rotation.z;
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
    
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const game = new OpenWorldGame();
  console.log("Game started");
});

