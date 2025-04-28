import { Component, Inject, OnInit,AfterViewInit, PLATFORM_ID,ViewChild ,ChangeDetectorRef,HostListener} from '@angular/core';

import { isPlatformBrowser } from '@angular/common';

  import { FormGroup,FormBuilder, FormControl, Validator, Validators } from "@angular/forms";
  import { CommonModule } from '@angular/common'; // Import CommonModule for ngFor
  import { ReactiveFormsModule, FormsModule } from '@angular/forms'; // Import for form handling
  declare var Winwheel: any; // Declare Winwheel so it is recognized by TypeScript
  import { WinnersAlertComponent } from '../../components/winners-alert/winners-alert.component'
  
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule,WinnersAlertComponent], // Include necessary modules
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.less']
})
 
export class HomeComponent implements OnInit {
    wheelForm: FormGroup;
    newItem: string = '';
    wheelSegments: { text: string, fillStyle: string }[] = []; // Store segments with color
    wheel: any; // Reference to the Winwheel instance
    firstTime:boolean=true;
    // Define colors for the default segments
    private defaultColors: string[] = ['#00FF00', '#0000FF', '#FFFF00', '#FF7F00', '#FF0000', '#4B0082', '#8B00FF', '#FF69B4'];
    spinning: boolean = false; // Track whether the wheel is currently spinning
    buttonLabel: string = 'Spin the Wheel'; // Initial button label
    prizes: string[] = []; // Array to hold prizes
    winners: { name: string, prize: string }[] = []; // List to store winners
    maxWinners = 10; // Limit the number of winners displayed
    newPrize: string = ''; // Input for new prize
    @ViewChild('winnersModal') winnersModal: any;
    winner: string = '';
    isModalOpen = false;
    winnerName:string='';
    modalTitle:string='';
    randomColor:string='';
    randomLetters:string='';
    prizeName:string='';
    wonPrizes!: boolean[];
    isMobile: boolean = false;
    showAds: boolean = true; 
    constructor(@Inject(PLATFORM_ID) private platformId: Object, private fb: FormBuilder, private cdr: ChangeDetectorRef) { 
      this.wonPrizes = new Array(this.prizes.length).fill(false);
      this.wheelForm = this.fb.group({
        newItem: ['', Validators.required],
        newPrize: ['']
      });
    }
    currentWinner: { name: string, prize: string } | null = null;
    async ngOnInit() {
      try {
        this.checkScreenSize(); // Initial screen size check
        this.defaultSegments();
    
        // Ensure wheelSegments are defined before proceeding
        if (!this.wheelSegments || this.wheelSegments.length === 0) {
          throw new Error('Wheel segments are not defined or empty.');
        }
    
        // Define a random initial angle
        const totalSegments = this.wheelSegments.length;
        const anglePerSegment = 360 / totalSegments;
        const randomIndex = Math.floor(Math.random() * totalSegments);
        const randomStartAngle = randomIndex * anglePerSegment + Math.random() * anglePerSegment;
    
        // Set the wheel's starting position
        this.updateWheel(randomStartAngle);
    
      } catch (error) {
        console.error('Error during initialization:', error);
      }
    }
    
    addItem(): void {
      const newItem = this.wheelForm.get('newItem')?.value.trim();

      if (!newItem) {
        return;
      }

      if (this.wheelSegments.length > 0 && this.firstTime) {
        this.wheelSegments = []; // Clear default segments
      }

      let assignedColor: string;

      if (this.wheelSegments.length < 8) {
        assignedColor = this.defaultColors[this.wheelSegments.length % this.defaultColors.length];
      } else {
        const limitedColors = ['#FFFFFF', '#0000FF', '#FF0000']; // Cycle after 8 segments
        assignedColor = limitedColors[this.wheelSegments.length % limitedColors.length];
      }

      this.wheelSegments.push({ text: newItem, fillStyle: assignedColor });
      this.wheelForm.get('newItem')?.reset(); // Clear the input field

      this.updateWheelSegments();
      this.firstTime = false;
    }
    
    
    removeItem(index: number): void {
      // Remove the item at the specified index
      this.wheelSegments.splice(index, 1);

      // If no segments are left, reset to default segments
      if (this.wheelSegments.length === 0) {
        this.firstTime=true;
        this.defaultSegments();
      } else {
          this.updateWheelSegments(); // Update the wheel segments with the remaining items
      }
  }

defaultSegments(): void {
  const defaultSegments = [
    { text: 'Green', fillStyle: '#00FF00' },
    { text: 'Blue', fillStyle: '#0000FF' },
    { text: 'Yellow', fillStyle: '#FFFF00' },
    { text: 'Orange', fillStyle: '#FF7F00' },
    { text: 'Red', fillStyle: '#FF0000' },
    { text: 'Indigo', fillStyle: '#4B0082' },
    { text: 'Violet', fillStyle: '#8B00FF' },
    { text: 'Pink', fillStyle: '#FF69B4' }
  ];

  this.wheelSegments = [...defaultSegments]; // Assign default segments
  this.createWheel(defaultSegments); // Ensure the wheel is created
}

    updateWheelSegments(): void {
      // Check the number of segments and create the wheel accordingly
      if (this.wheelSegments.length <= 16) {
        this.createWheel(this.wheelSegments); // Create wheel with the updated segments
      } else {
        // Create segments with alternating colors: blue, white, and red
        const colors = ['#0000FF', '#FFFFFF', '#FF0000']; // Blue, White, Red
        const segments = this.wheelSegments.map((segment, index) => ({
          text: segment.text,
          fillStyle: colors[index % colors.length], // Alternate colors
        }));
        this.createWheel(segments); // Create wheel with blue, white, and red segments
      }
    }
    
  createWheel(segments: { text: string, fillStyle: string }[] = []): void {
    const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) return; // Exit if no context

    this.clearCanvas(ctx, canvas.width, canvas.height);
    this.drawOuterCircle(ctx, canvas); // Draw outer circle
    this.drawInnerCircle(ctx, canvas); // Draw inner circle

    // Create the wheel using Winwheel.js
    this.wheel = new Winwheel({
      canvasId: 'myCanvas',
      numSegments: segments.length || 1,
      segments: segments.length > 0 ? segments : [{ text: 'Default', fillStyle: '#FFFFFF' }],
      innerRadius: 50,
      animation: {
        type: 'spinToStop',
        duration: 6, // Spin duration in seconds
        spins: 10, // Number of spins before stopping
        soundTrigger: 'pin',
        callbackSound: this.playSound.bind(this)
      },
      pins: { number: 16, responsive: true }
    });

    this.wheel.draw();
    this.drawArrow(ctx, canvas.width / 2, canvas.height / 2 - (canvas.width / 2 - 10) - 10); // Position arrow
  }
  private drawOuterCircle(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    const outerRadius = canvas.width / 2 - 10; // Adjust radius for padding
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, outerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF'; // Fill circle with white or desired color
    ctx.fill();
    ctx.stroke();
  }

  private drawInnerCircle(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    const outerRadius = canvas.width / 2 - 10; // Use the outer circle's radius
    const innerRadius = outerRadius - 40; // Inner circle radius
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF'; // Fill inner circle with white or desired color
    ctx.fill();
    ctx.stroke();
  }
  // Method to draw the arrow
  private drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.beginPath();
    ctx.moveTo(x - 10, y); // Left side of the arrow
    ctx.lineTo(x + 10, y); // Right side of the arrow
    ctx.lineTo(x, y + 20); // Tip of the arrow (pointing down)
    ctx.closePath();
    ctx.fillStyle = '#00FFFF'; // Arrow color
    ctx.fill();
  }
  spinWheel(): void {
    this.isModalOpen = false;
    if (this.wheelSegments.length <= 1) {
      return; // Exit if not enough segments
    }
  
    if (!this.spinning) {
      this.spinning = true;
      this.buttonLabel = 'Reset';
  
      // Create the wheel with current segments
      this.createWheel(this.wheelSegments);
  
      const duration = 3000; // Total spin duration (ms)
      const startAngle = Math.floor(Math.random() * this.wheelSegments.length);
      const stopAngle = Math.floor(Math.random() * 360 + 1440);
  
      const tickSound = new Audio('assets/sounds/spin.mp3');
      let tickInterval = setInterval(() => tickSound.play(), 100);
  
      let currentAngle = startAngle;
      const spinStartTime = performance.now();
  
      // Manual animation loop for smooth spinning
      const animateSpin = (timestamp: number) => {
        const elapsedTime = timestamp - spinStartTime;
        const progress = Math.min(elapsedTime / duration, 1); // Ensure progress doesn't exceed 1
  
        // Apply easing function for smooth deceleration
        currentAngle = startAngle + (stopAngle - startAngle) * this.easeOutQuad(progress);
        this.wheel.rotationAngle = currentAngle;
        this.wheel.draw();
  
        if (progress < 1) {
          requestAnimationFrame(animateSpin);
        } else {
          // Spin complete
          clearInterval(tickInterval); // Stop tick sound
          tickSound.pause();
          tickSound.currentTime = 0;
  
          // Determine the winner
          const winningSegment = this.wheel.getIndicatedSegment();
          this.handleWinner(winningSegment);
  
          this.spinning = false;
        }
      };
  
      requestAnimationFrame(animateSpin);
    }
  }
  
  handleWinner(winningSegment: any): void {
    console.log('winningSegment',winningSegment)
    const winnerName = winningSegment;
    const winnerPrize = this.prizes[Math.floor(Math.random() * this.prizes.length)];

    this.winnerName = winnerName;
    this.currentWinner = { name: winnerName, prize: winnerPrize };

    const prizeIndex = this.prizes.length - 1;
    this.prizeName = this.prizes[prizeIndex] ?? 'House and Lot';
    this.wonPrizes[prizeIndex] = true;
    this.prizes.splice(prizeIndex, 1);

    this.isModalOpen = true;
    this.addWinner(winnerName, this.prizeName);

    // Draw the arrow on the canvas
    const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      this.drawArrow(ctx, canvas.width / 2, canvas.height / 2 - (canvas.width / 2 - 10) - 10);
    }
  }
  // Helper function for ease-out effect (slows down towards the end)
  easeOutQuad(t: number): number {
    return t * (2 - t);
  }


  playSound(callbackSound: () => void) {
    const spinAudio = document.getElementById('spinSound') as HTMLAudioElement;
  //   spinAudio.play();
    spinAudio.currentTime = 0; // Reset audio to start
    spinAudio.play();
    
    // Start fast
    spinAudio.playbackRate = 3.0; // Very fast playback rate for the first 5 seconds

    // Slow down after 5 seconds
    setTimeout(() => {
      callbackSound();
    }, 5000); // 5000ms = 5 seconds
  }

  // Callback to gradually slow down the sound
  callbackSound() {
    const spinAudio = document.getElementById('spinSound') as HTMLAudioElement;
  //   spinAudio.play();
    const duration = 3000; // Time to slow down in milliseconds (adjust as needed)
    const steps = 20; // Number of steps to slow down
    const decrement = (3.0 - 1.0) / steps; // Decrease from 3.0 to 1.0

    let currentStep = 0;

    const interval = setInterval(() => {
      if (currentStep < steps) {
        spinAudio.playbackRate -= decrement; // Decrease playback rate
        currentStep++;
      } else {
        clearInterval(interval); // Stop when it reaches normal speed
        spinAudio.playbackRate = 1.0; // Ensure normal speed after slowing down
      }
    }, duration / steps); // Interval timing
  }


  resetWheel(): void {
    const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d'); // Get the canvas context again

    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

      this.spinning = false; // Reset spinning state
      this.buttonLabel = 'Spin the Wheel'; // Change button label back to Spin
      this.drawArrow(ctx, canvas.width / 2, canvas.height / 2 - 60); // Draw the arrow on top again
    }
  }

  onPlayerRemoved(playerName: string) {
    // Logic to remove the player from the players list
  this.isModalOpen = false;
    // Logic to remove the player from the wheel segments
    const index = this.wheelSegments.findIndex(segment => segment.text === playerName);
    if (index !== -1) {
      this.wheelSegments.splice(index, 1); // Remove from wheel segments
    }

    // Optionally, you may want to redraw the wheel here if needed
    this.createWheel(this.wheelSegments);
  }

  // Function to remove the winner from wheelSegments
  removeWinner(index: number): void {
    if (this.currentWinner) {
      const index = this.wheelSegments.findIndex(segment => segment.text === this.currentWinner?.name);
      if (index !== -1) {
        this.wheelSegments.splice(index, 1); // Remove the winner from the segments
      }
      this.currentWinner = null; // Clear the current winner
    }
  }
  // Assuming you have a separate array to keep track of grand prize winners
  grandPrizeWinners: Array<any> = []; // Replace 'any' with your winner model if you have one

  addWinnerToGrandPrize(winner: any) {
    // Check if the winner is already in the grand prize list to avoid duplicates
    if (!this.grandPrizeWinners.includes(winner)) {
      this.grandPrizeWinners.push(winner);
    // alert(${winner.name} has been added to the grand prize list!);
    } else {
    // alert(${winner.name} is already in the grand prize list.);
    }
  }

    
    addWinnerBack(winner: { name: string; prize: string }, index: number) {
      // Generate a random color
      const randomColor = this.getRandomColor();
    
      // Add the winner back to the wheel segments
      this.wheelSegments.push({
        text: winner.name,
        fillStyle: randomColor
      });
      this.createWheel(this.wheelSegments);
      // Remove the winner from the winners list
      this.winners.splice(index, 1); // Remove the winner at the provided index
      this.cdr.detectChanges();

    }

  //
  getSegmentByAngle(angle: number) {

    console.log("getSegmentByAngle angle",angle)
    // Normalize the angle to ensure it's between 0 and 360
    const normalizedAngle = angle % 360;

    const segmentAngle = 360 / this.wheelSegments.length; // Angle for each segment

    // Loop through the wheelSegments to find which one the angle falls into
    for (let index = 0; index < this.wheelSegments.length; index++) {
      const startAngle = index * segmentAngle; // Calculate start angle for the segment
      const endAngle = (index + 1) * segmentAngle; // Calculate end angle for the segment

      // Check if the normalized angle is within the start and end angles
      if (normalizedAngle >= startAngle && normalizedAngle < endAngle) {
        return this.wheelSegments[index]; // Return the winning segment
      }
    }

    return null; // No valid segment found
  }
  // Update the wheel's current angle
  updateWheel(currentAngle: number) {
    const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.drawWheel(currentAngle); 
    }

  }
  drawWheel(angle: number) {
    const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
    if (!canvas) return; // Early return if the canvas is not found

    const ctx = canvas.getContext('2d');
    if (!ctx) return; // Early return if the context is null

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10; // Adjust radius as needed
    const segmentAngle = 360 / this.wheelSegments.length; // Angle for each segment

    // Draw each segment
    this.wheelSegments.forEach((segment, index) => {
      const startAngle = (index * segmentAngle + angle) * (Math.PI / 180); // Convert to radians
      const endAngle = ((index + 1) * segmentAngle + angle) * (Math.PI / 180); // Convert to radians

      // Set fill color based on segment's fillStyle
      ctx.fillStyle = segment.fillStyle;

      // Draw the segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY); // Move to center
      ctx.arc(centerX, centerY, radius, startAngle, endAngle); // Draw arc
      ctx.lineTo(centerX, centerY); // Close the segment
      ctx.fill(); // Fill the segment

      // Draw the segment text
      this.drawSegmentText(ctx, segment.text, startAngle, endAngle, radius);
    });
  }

  // Helper method to draw text inside each segment
  drawSegmentText(ctx: CanvasRenderingContext2D, text: string, startAngle: number, endAngle: number, radius: number) {
    const middleAngle = (startAngle + endAngle) / 2; // Calculate the middle angle for text placement
    const x = Math.cos(middleAngle) * (radius / 2); // Position text
    const y = Math.sin(middleAngle) * (radius / 2); // Position text

    ctx.fillStyle = '#FFFFFF'; // Text color
    ctx.font = 'bold 12px Arial'; // Text style
    ctx.textAlign = 'center'; // Center text
    ctx.textBaseline = 'middle'; // Vertical center text
    ctx.fillText(text, x + (ctx.canvas.width / 2), y + (ctx.canvas.height / 2)); // Draw text
  }

  // Helper method to get segment color
  getSegmentColor(index: number): string {
    const colors = [
      '#FF0000', // Red
      '#FF7F00', // Orange
      '#FFFF00', // Yellow
      '#7FFF00', // Yellow-Green
      '#00FF00', // Green
      '#00FF7F', // Spring Green
      '#00FFFF', // Cyan
      '#007FFF', // Azure
      '#0000FF', // Blue
      '#7F00FF', // Violet
      '#FF00FF', // Magenta
      '#FF007F', // Rose
      '#FFFFFF', // White
      '#000000', // Black
      '#C0C0C0', // Silver
      '#808080', // Gray
      '#FFFFE0', // Light Yellow
    ];

    return colors[index % colors.length]; // Cycle through colors
  }

  // Remember to terminate the worker when the component is destroyed
  ngOnDestroy() {
   
  }
  
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    if (typeof window !== 'undefined') {
      this.isMobile = window.innerWidth <= 768; // Adjust threshold as needed
  }
  
    
  }


  getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  closeAds() {
    this.showAds = false;
  }
  
  shuffle(): void {
    this.wheelSegments.sort(() => Math.random() - 0.5);
    this.updateWheelSegments(); // Update the wheel segments after shuffling
}

sort(): void {
    this.wheelSegments.sort((a, b) => a.text.localeCompare(b.text));
    this.updateWheelSegments(); // Update the wheel segments after sorting
}

uploadImage(): void {
    // Simulate image upload
    console.log('Image upload function triggered.');
}

removeAll(): void {
    this.wheelSegments = []; // Clear the segments
    this.firstTime=true;
    this.updateWheelSegments(); // Update the wheel segments
    this.defaultSegments()
    
}

addPrize(): void {
  const newPrizeControl = this.wheelForm.get('newPrize');

  if (newPrizeControl?.invalid) {
    return;
  }

  this.prizes.push(newPrizeControl?.value || ''); // Ensure value exists before pushing
  newPrizeControl?.reset();  // Reset the form control if it exists
}


// Function to remove a prize by name
removePrize(prize: string): void {
  this.prizes = this.prizes.filter(p => p !== prize);
}

alertPrizeWinner(): void {
    
  setTimeout(() => {
  const winnerAudio = document.getElementById('congratsSound') as HTMLAudioElement;
  this.isModalOpen = true;
  winnerAudio.play();
  this.cdr.detectChanges();
    }, 1000);
}

closeModal() {
  this.isModalOpen = false;
}

// Helper function to clear the canvas
private clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
}


showWinner(winner: string): void {
  //alert(The winner is: ${winner}); // Temporary alert, replace with modal
}

addWinner(winnerName: string,prize:string): void {
  // Add the winner to the list and limit the number of winners
  this.winners.unshift({ name: winnerName, prize: prize });
  if (this.winners.length > this.maxWinners) {
    this.winners.pop(); // Remove the oldest winner if over limit
  }
}
  }
