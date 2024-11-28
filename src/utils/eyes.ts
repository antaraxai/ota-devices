interface ExpressionOptions {
  type: 'happy' | 'sad' | 'angry' | 'focused' | 'confused';
  duration?: number;
}

export class Eyes {
  private leftEye: {
    upper: HTMLElement | null;
    lower: HTMLElement | null;
  };
  private rightEye: {
    upper: HTMLElement | null;
    lower: HTMLElement | null;
  };
  private blinkInterval: number | null = null;
  private currentExpression: string = 'happy';

  constructor() {
    this.leftEye = {
      upper: null,
      lower: null
    };
    this.rightEye = {
      upper: null,
      lower: null
    };
  }

  initialize(container: HTMLElement) {
    this.stopBlinking();
    
    this.leftEye = {
      upper: container.querySelector('.eye.left .eyelid.upper'),
      lower: container.querySelector('.eye.left .eyelid.lower')
    };
    this.rightEye = {
      upper: container.querySelector('.eye.right .eyelid.upper'),
      lower: container.querySelector('.eye.right .eyelid.lower')
    };

    this.startBlinking();
  }

  startBlinking() {
    this.stopBlinking();
    
    this.blink();
    
    this.blinkInterval = window.setInterval(() => {
      this.blink();
    }, 5000);
  }

  stopBlinking() {
    if (this.blinkInterval) {
      window.clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
  }

  blink() {
    const currentExpression = this.currentExpression;

    this.setTransform(this.leftEye.upper, 'translateY(50px)');
    this.setTransform(this.leftEye.lower, 'translateY(-50px)');
    this.setTransform(this.rightEye.upper, 'translateY(50px)');
    this.setTransform(this.rightEye.lower, 'translateY(-50px)');

    setTimeout(() => {
      this.express({ type: currentExpression });
    }, 150);
  }

  express({ type }: { type: string }) {
    console.log('Expressing:', type);
    this.currentExpression = type;
    
    this.setTransform(this.leftEye.upper, 'none');
    this.setTransform(this.leftEye.lower, 'none');
    this.setTransform(this.rightEye.upper, 'none');
    this.setTransform(this.rightEye.lower, 'none');

    switch (type) {
      case 'happy':
        this.setTransform(this.leftEye.lower, 'translateY(-20px)');
        this.setTransform(this.rightEye.lower, 'translateY(-20px)');
        break;
      case 'sad':
        this.setTransform(this.leftEye.upper, 'translateY(20px)');
        this.setTransform(this.rightEye.upper, 'translateY(20px)');
        break;
      case 'angry':
        this.setTransform(this.leftEye.upper, 'translateY(20px) rotate(-15deg)');
        this.setTransform(this.rightEye.upper, 'translateY(20px) rotate(15deg)');
        break;
      case 'focused':
        this.setTransform(this.leftEye.upper, 'translateY(15px)');
        this.setTransform(this.leftEye.lower, 'translateY(-15px)');
        this.setTransform(this.rightEye.upper, 'translateY(15px)');
        this.setTransform(this.rightEye.lower, 'translateY(-15px)');
        break;
      case 'confused':
        this.setTransform(this.leftEye.upper, 'translateY(20px) rotate(-10deg)');
        this.setTransform(this.rightEye.upper, 'translateY(10px)');
        break;
    }
  }

  private setTransform(element: HTMLElement | null, value: string) {
    if (element) {
      element.style.transform = value;
    }
  }

  cleanup() {
    this.stopBlinking();
  }
} 