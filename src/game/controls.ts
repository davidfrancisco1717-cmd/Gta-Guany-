export class DesktopInputManager {
  public held = new Set<string>();
  private justPressedSet = new Set<string>();
  public lookDeltaX = 0;
  public lookDeltaY = 0;
  public isDraggingLook = false;
  public attackTriggered = false;
  public recentLookTimer = 0;

  private canvas: HTMLElement | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragMoved = false;

  public attach(canvas: HTMLElement): () => void {
    this.canvas = canvas;

    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.held.has(e.code)) {
        this.justPressedSet.add(e.code);
      }
      this.held.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.held.delete(e.code);
    };

    const onBlur = () => {
      this.held.clear();
      this.justPressedSet.clear();
      this.isDraggingLook = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.target !== this.canvas) return;
      if (e.button === 0 || e.button === 2) {
        this.isDraggingLook = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragMoved = false;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === this.canvas) {
        this.lookDeltaX += e.movementX;
        this.lookDeltaY += e.movementY;
        this.recentLookTimer = 1.1;
        return;
      }
      if (this.isDraggingLook) {
        const dx = e.movementX;
        const dy = e.movementY;
        if (Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY) > 5) {
          this.dragMoved = true;
        }
        this.lookDeltaX += dx;
        this.lookDeltaY += dy;
        this.recentLookTimer = 1.1;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && e.target === this.canvas && !this.dragMoved) {
        this.attackTriggered = true;
      }
      this.isDraggingLook = false;
    };

    const onContextMenu = (e: MouseEvent) => {
      if (e.target === this.canvas) e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }

  public isHeld(code: string): boolean {
    return this.held.has(code);
  }

  public consumeJustPressed(code: string): boolean {
    if (this.justPressedSet.has(code)) {
      this.justPressedSet.delete(code);
      return true;
    }
    return false;
  }

  public consumeLookDelta(dt: number): { dx: number; dy: number; isLooking: boolean } {
    const dx = this.lookDeltaX;
    const dy = this.lookDeltaY;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    if (this.recentLookTimer > 0) this.recentLookTimer = Math.max(0, this.recentLookTimer - dt);
    return { dx, dy, isLooking: this.recentLookTimer > 0 || this.isDraggingLook };
  }

  public consumeAttack(): boolean {
    const fired = this.attackTriggered;
    this.attackTriggered = false;
    return fired;
  }

  public clearFrameEdges(): void {
    this.justPressedSet.clear();
    this.attackTriggered = false;
  }
}
