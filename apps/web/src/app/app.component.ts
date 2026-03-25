import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, QueryList, ViewChild, ViewChildren, inject } from '@angular/core';
import gsap from 'gsap';
import { PrimeNG } from 'primeng/config';
import { RouterOutlet } from '@angular/router';
import { AppFeedbackCenterComponent } from './core/layout/app-feedback-center.component';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppFeedbackCenterComponent],
  templateUrl: './app.component.html',
  host: {
    class: 'block min-h-screen'
  },
  styles: `
    :host {
      position: relative;
      display: block;
      min-height: 100vh;
    }

    .app-ambient {
      position: fixed;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
      background: var(--app-bg-accent);
    }

    .app-ambient__field {
      position: absolute;
      inset: -16vmax;
      filter: saturate(calc(118% * var(--app-scroll-glow)));
      transform: translateZ(0);
    }

    .app-ambient__lava {
      position: absolute;
      border-radius: 999px;
      will-change: transform, opacity, filter;
      mix-blend-mode: screen;
      transform: translateZ(0);
      backface-visibility: hidden;
      isolation: isolate;
    }

    .app-ambient__lava--one {
      left: -10%;
      top: -8%;
      width: 56rem;
      height: 42rem;
      background:
        radial-gradient(ellipse 44% 38% at 22% 28%, color-mix(in srgb, var(--app-ambient-1) 56%, white) 0%, color-mix(in srgb, var(--app-ambient-1) 78%, white) 18%, color-mix(in srgb, var(--app-ambient-1) 28%, transparent) 46%, transparent 74%),
        radial-gradient(ellipse 30% 28% at 72% 30%, color-mix(in srgb, var(--app-ambient-4) 52%, white) 0%, color-mix(in srgb, var(--app-ambient-4) 76%, white) 16%, color-mix(in srgb, var(--app-ambient-4) 24%, transparent) 42%, transparent 72%),
        radial-gradient(ellipse 36% 32% at 42% 76%, color-mix(in srgb, var(--app-ambient-2) 50%, white) 0%, color-mix(in srgb, var(--app-ambient-2) 70%, white) 16%, color-mix(in srgb, var(--app-ambient-2) 20%, transparent) 44%, transparent 72%),
        radial-gradient(circle at 30% 34%, rgba(255, 255, 255, 0.12) 0%, transparent 12%),
        radial-gradient(circle at 62% 46%, rgba(255, 255, 255, 0.08) 0%, transparent 11%);
      background-repeat: no-repeat;
      filter: blur(78px) saturate(112%);
      opacity: 0.42;
    }

    .app-ambient__lava--two {
      right: -8%;
      top: 10%;
      width: 48rem;
      height: 38rem;
      background:
        radial-gradient(ellipse 42% 34% at 68% 70%, color-mix(in srgb, var(--app-ambient-3) 44%, white) 0%, color-mix(in srgb, var(--app-ambient-3) 68%, white) 18%, color-mix(in srgb, var(--app-ambient-3) 18%, transparent) 46%, transparent 74%),
        radial-gradient(ellipse 28% 26% at 24% 60%, color-mix(in srgb, var(--app-ambient-2) 52%, white) 0%, color-mix(in srgb, var(--app-ambient-2) 74%, white) 16%, color-mix(in srgb, var(--app-ambient-2) 18%, transparent) 42%, transparent 70%),
        radial-gradient(ellipse 34% 30% at 54% 34%, color-mix(in srgb, var(--app-ambient-1) 38%, white) 0%, color-mix(in srgb, var(--app-ambient-1) 62%, white) 16%, color-mix(in srgb, var(--app-ambient-1) 16%, transparent) 44%, transparent 72%),
        radial-gradient(circle at 58% 62%, rgba(255, 255, 255, 0.1) 0%, transparent 11%),
        radial-gradient(circle at 28% 48%, rgba(255, 255, 255, 0.08) 0%, transparent 10%);
      background-repeat: no-repeat;
      filter: blur(86px) saturate(108%);
      opacity: 0.34;
    }

    .app-ambient__glow {
      position: absolute;
      left: 0;
      top: 0;
      width: 30rem;
      height: 24rem;
      border-radius: 42% 58% 63% 37% / 44% 36% 64% 56%;
      opacity: 0;
      background:
        radial-gradient(ellipse at 30% 35%, color-mix(in srgb, var(--accent-1) 38%, white) 0%, transparent 38%),
        radial-gradient(ellipse at 68% 42%, color-mix(in srgb, var(--app-ambient-2) 92%, white) 0%, transparent 34%),
        radial-gradient(ellipse at 46% 72%, color-mix(in srgb, var(--app-ambient-4) 88%, white) 0%, transparent 42%);
      filter: blur(46px);
      transform: translate3d(-50%, -50%, 0);
      will-change: transform, opacity;
      mix-blend-mode: screen;
    }

    .app-ambient__glow--one {
      opacity: 0;
    }

    .app-ambient__glow--two {
      width: 22rem;
      height: 18rem;
      opacity: 0;
      background:
        radial-gradient(ellipse at 34% 30%, color-mix(in srgb, var(--app-ambient-4) 94%, white) 0%, transparent 40%),
        radial-gradient(ellipse at 72% 60%, color-mix(in srgb, var(--accent-1) 28%, white) 0%, transparent 38%);
      filter: blur(40px);
    }

    .app-ambient__orb {
      position: absolute;
      border-radius: 999px;
      will-change: transform, opacity;
      mix-blend-mode: screen;
      transform: translate3d(var(--app-scroll-shift-x), var(--app-scroll-shift-y), 0);
      backface-visibility: hidden;
    }

    .app-ambient__orb--one {
      left: -4%;
      top: -2%;
      width: 46rem;
      height: 46rem;
      background:
        radial-gradient(circle at 34% 34%, rgba(255, 255, 255, 0.22) 0%, transparent 14%),
        radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--app-ambient-1) 58%, white) 0%, color-mix(in srgb, var(--app-ambient-1) 72%, white) 16%, color-mix(in srgb, var(--app-ambient-1) 36%, transparent) 42%, transparent 70%);
      filter: blur(46px) saturate(120%);
    }

    .app-ambient__orb--two {
      right: -2%;
      top: 22%;
      width: 30rem;
      height: 30rem;
      background:
        radial-gradient(circle at 40% 38%, rgba(255, 255, 255, 0.18) 0%, transparent 13%),
        radial-gradient(circle at 52% 50%, color-mix(in srgb, var(--app-ambient-2) 54%, white) 0%, color-mix(in srgb, var(--app-ambient-2) 74%, white) 15%, color-mix(in srgb, var(--app-ambient-2) 32%, transparent) 44%, transparent 68%);
      filter: blur(54px) saturate(122%);
    }

    .app-ambient__orb--three {
      left: 18%;
      bottom: -12%;
      width: 54rem;
      height: 54rem;
      background:
        radial-gradient(circle at 42% 36%, rgba(255, 255, 255, 0.14) 0%, transparent 12%),
        radial-gradient(circle at 50% 52%, color-mix(in srgb, var(--app-ambient-3) 44%, white) 0%, color-mix(in srgb, var(--app-ambient-3) 62%, white) 18%, color-mix(in srgb, var(--app-ambient-3) 28%, transparent) 48%, transparent 74%);
      filter: blur(106px) saturate(116%);
      opacity: calc(0.84 + ((var(--app-scroll-glow) - 1) * 0.6));
    }

    .app-ambient__orb--four {
      right: 16%;
      bottom: 8%;
      width: 18rem;
      height: 18rem;
      background:
        radial-gradient(circle at 38% 38%, rgba(255, 255, 255, 0.24) 0%, transparent 16%),
        radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--app-ambient-4) 56%, white) 0%, color-mix(in srgb, var(--app-ambient-4) 78%, white) 16%, color-mix(in srgb, var(--app-ambient-4) 34%, transparent) 40%, transparent 66%);
      filter: blur(36px) saturate(124%);
      opacity: 0.92;
    }

    .app-ambient__grain,
    .app-ambient__vignette {
      position: absolute;
      inset: 0;
    }

    .app-ambient__grain {
      opacity: 0.42;
      mix-blend-mode: soft-light;
      background-image:
        radial-gradient(circle at 20% 20%, var(--app-grain) 0 1px, transparent 1.4px),
        radial-gradient(circle at 80% 30%, var(--app-grain) 0 1px, transparent 1.5px),
        radial-gradient(circle at 35% 78%, var(--app-grain) 0 1.1px, transparent 1.6px),
        radial-gradient(circle at 68% 64%, var(--app-grain) 0 0.9px, transparent 1.4px),
        linear-gradient(135deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0));
      background-size: 28px 28px, 32px 32px, 24px 24px, 36px 36px, 100% 100%;
    }

    .app-ambient__grain::after {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0.08;
      mix-blend-mode: soft-light;
      background-image:
        radial-gradient(circle at 18% 22%, rgba(255, 255, 255, 0.18) 0 0.8px, transparent 1.4px),
        radial-gradient(circle at 64% 48%, rgba(255, 255, 255, 0.16) 0 0.7px, transparent 1.2px),
        radial-gradient(circle at 42% 74%, rgba(255, 255, 255, 0.14) 0 0.9px, transparent 1.6px);
      background-size: 22px 22px, 30px 30px, 26px 26px;
    }

    .app-ambient__vignette {
      background: radial-gradient(circle at center, transparent 38%, color-mix(in srgb, var(--app-bg) 16%, transparent) 100%);
    }

    @media (max-width: 768px) {
      .app-ambient__orb--one {
        width: 28rem;
        height: 28rem;
      }

      .app-ambient__orb--two {
        width: 24rem;
        height: 24rem;
      }

      .app-ambient__orb--three {
        width: 30rem;
        height: 30rem;
      }

      .app-ambient__orb--four {
        width: 12rem;
        height: 12rem;
      }

      .app-ambient__lava--one {
        width: 30rem;
        height: 24rem;
      }

      .app-ambient__lava--two {
        width: 24rem;
        height: 20rem;
      }
    }

  `
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly primeng = inject(PrimeNG);
  private readonly _theme = inject(ThemeService);
  @ViewChild('ambientField') private readonly ambientField?: ElementRef<HTMLDivElement>;
  @ViewChildren('ambientGlowBlob') private readonly ambientGlowBlobs?: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChildren('ambientLava') private readonly ambientLavaLayers?: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChildren('ambientLayer') private readonly ambientLayers?: QueryList<ElementRef<HTMLDivElement>>;
  private readonly ambientState = { x: 0, y: 0, glow: 1 };
  private ambientTween?: gsap.core.Tween;
  private ambientLoop?: gsap.core.Timeline;
  private ambientGlowTween?: gsap.core.Timeline;
  private ambientPulseTween?: gsap.core.Timeline;
  private ambientMorphTween?: gsap.core.Timeline;
  private ambientLavaLoop?: gsap.core.Timeline;
  private ambientGlowIdleLoop?: gsap.core.Timeline;

  constructor() {
    this.primeng.setTranslation({
      dayNames: ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'],
      dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
      dayNamesMin: ['Do', 'Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa'],
      monthNames: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
      monthNamesShort: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
      today: 'Oggi',
      clear: 'Pulisci',
      firstDayOfWeek: 1,
      chooseDate: 'Scegli data',
      prevMonth: 'Mese precedente',
      nextMonth: 'Mese successivo',
      prevYear: 'Anno precedente',
      nextYear: 'Anno successivo'
    });
  }

  ngAfterViewInit(): void {
    this.startAmbientLoop();
    this.startLavaLoop();
    this.startGlowIdleLoop();
    this.updateAmbientScroll();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateAmbientScroll();
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    this.updateAmbientGlow(event);
  }

  @HostListener('window:mouseleave')
  onWindowMouseLeave(): void {
    const glows = this.ambientGlowBlobs?.toArray().map((item) => item.nativeElement) ?? [];
    if (!glows.length) {
      return;
    }

    this.ambientGlowTween?.kill();
    this.ambientGlowTween = gsap.timeline()
      .to(glows, { opacity: 0, duration: 0.6, ease: 'power2.out' });
  }

  @HostListener('window:mousedown', ['$event'])
  onWindowMouseDown(event: MouseEvent): void {
    this.flashAmbientGlow(event.clientX, event.clientY, 0.95, 1.16);
  }

  @HostListener('document:focusin', ['$event'])
  onDocumentFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const rect = target.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      return;
    }

    this.flashAmbientGlow(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.72, 1.08);
  }

  ngOnDestroy(): void {
    this.ambientTween?.kill();
    this.ambientLoop?.kill();
    this.ambientLavaLoop?.kill();
    this.ambientGlowTween?.kill();
    this.ambientPulseTween?.kill();
    this.ambientMorphTween?.kill();
    this.ambientGlowIdleLoop?.kill();
  }

  private updateAmbientScroll(): void {
    const root = this.document.documentElement;
    const view = this.document.defaultView;
    const scrollY = view?.scrollY || 0;
    const depth = Math.min(scrollY, 1600);
    const reducedMotion = view?.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      this.ambientTween?.kill();
      this.ambientLoop?.pause(0);
      this.ambientLavaLoop?.pause(0);
      this.ambientGlowIdleLoop?.pause(0);
      root.style.setProperty('--app-scroll-shift-y', '0px');
      root.style.setProperty('--app-scroll-shift-x', '0px');
      root.style.setProperty('--app-scroll-glow', '1');
      return;
    }

    this.ambientLoop?.play();
    this.ambientLavaLoop?.play();
    this.ambientGlowIdleLoop?.play();

    this.ambientTween?.kill();
    this.ambientTween = gsap.to(this.ambientState, {
      x: depth * 0.012,
      y: depth * 0.035,
      glow: Math.min(1.16, 1 + depth / 6000),
      duration: 1.2,
      ease: 'power3.out',
      overwrite: true,
      onUpdate: () => {
        root.style.setProperty('--app-scroll-shift-y', `${this.ambientState.y.toFixed(2)}px`);
        root.style.setProperty('--app-scroll-shift-x', `${this.ambientState.x.toFixed(2)}px`);
        root.style.setProperty('--app-scroll-glow', this.ambientState.glow.toFixed(3));
      },
    });
  }

  private startAmbientLoop(): void {
    const view = this.document.defaultView;
    if (view?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const layers = this.ambientLayers?.toArray().map((item) => item.nativeElement).filter(Boolean) ?? [];
    if (!layers.length) {
      return;
    }

    this.ambientLoop?.kill();
    this.ambientLoop = gsap.timeline({ repeat: -1, defaults: { ease: 'sine.inOut' } });
    this.ambientLoop
      .to(layers[0], { xPercent: 12, yPercent: 8, scale: 1.12, rotation: 4, duration: 11 }, 0)
      .to(layers[1], { xPercent: -14, yPercent: -6, scale: 1.16, rotation: -6, duration: 14 }, 0)
      .to(layers[2], { xPercent: 10, yPercent: -10, scale: 1.08, rotation: 3, duration: 17 }, 0)
      .to(layers[3], { xPercent: -18, yPercent: 12, scale: 1.18, rotation: 8, duration: 10 }, 0)
      .to(layers[0], { xPercent: -10, yPercent: 6, scale: 1.06, rotation: -3, duration: 13 }, '>-1')
      .to(layers[1], { xPercent: 9, yPercent: 10, scale: 1.08, rotation: 4, duration: 16 }, '<')
      .to(layers[2], { xPercent: -8, yPercent: -4, scale: 1.12, rotation: -2, duration: 18 }, '<')
      .to(layers[3], { xPercent: 14, yPercent: -10, scale: 1.05, rotation: -6, duration: 12 }, '<')
      .to(layers[0], { xPercent: 4, yPercent: -12, scale: 1.14, rotation: 6, duration: 12 }, '>-2')
      .to(layers[1], { xPercent: -6, yPercent: 4, scale: 1.13, rotation: -2, duration: 14 }, '<')
      .to(layers[2], { xPercent: 12, yPercent: 8, scale: 1.04, rotation: 5, duration: 16 }, '<')
      .to(layers[3], { xPercent: -10, yPercent: 6, scale: 1.16, rotation: 9, duration: 11 }, '<');
  }

  private startLavaLoop(): void {
    const view = this.document.defaultView;
    if (view?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const lavaLayers = this.ambientLavaLayers?.toArray().map((item) => item.nativeElement) ?? [];
    if (!lavaLayers.length) {
      return;
    }

    this.ambientLavaLoop?.kill();
    gsap.set(lavaLayers[0], {
      scale: 1,
      opacity: 0.42,
      xPercent: 0,
      yPercent: 0,
      rotation: 0,
    });
    gsap.set(lavaLayers[1], {
      scale: 1,
      opacity: 0.34,
      xPercent: 0,
      yPercent: 0,
      rotation: 0,
    });

    this.ambientLavaLoop = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } });
    this.ambientLavaLoop
      .to(lavaLayers[0], { xPercent: 8, yPercent: 6, scale: 1.04, rotation: 4, opacity: 0.44, duration: 11 }, 0)
      .to(lavaLayers[1], { xPercent: -7, yPercent: 8, scale: 1.06, rotation: -5, opacity: 0.36, duration: 13 }, 0)
      .to(lavaLayers[0], { xPercent: -6, yPercent: 10, scale: 0.99, rotation: -3, opacity: 0.4, duration: 12 }, '>-0.5')
      .to(lavaLayers[1], { xPercent: 6, yPercent: -6, scale: 1.02, rotation: 4, opacity: 0.32, duration: 13 }, '<')
      .to(lavaLayers[0], { xPercent: 10, yPercent: -4, scale: 1.05, rotation: 5, opacity: 0.43, duration: 12 }, '>-0.5')
      .to(lavaLayers[1], { xPercent: -8, yPercent: 4, scale: 1.05, rotation: -4, opacity: 0.35, duration: 13 }, '<');
  }

  private startGlowIdleLoop(): void {
    const view = this.document.defaultView;
    if (view?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const glows = this.ambientGlowBlobs?.toArray().map((item) => item.nativeElement) ?? [];
    if (glows.length < 2) {
      return;
    }

    this.ambientGlowIdleLoop?.kill();
    this.ambientGlowIdleLoop = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } });
    this.ambientGlowIdleLoop
      .to(glows[0], { borderRadius: '55% 45% 36% 64% / 43% 60% 40% 57%', rotation: 6, duration: 4.6 }, 0)
      .to(glows[1], { borderRadius: '37% 63% 58% 42% / 52% 38% 62% 48%', rotation: -8, duration: 5.2 }, 0);
  }

  private updateAmbientGlow(event: MouseEvent): void {
    const glows = this.ambientGlowBlobs?.toArray().map((item) => item.nativeElement) ?? [];
    const field = this.ambientField?.nativeElement;
    const view = this.document.defaultView;

    if (glows.length < 2 || !field || view?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const bounds = field.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const dx = x - bounds.width / 2;
    const dy = y - bounds.height / 2;
    const stretchX = 1 + Math.min(Math.abs(dx) / Math.max(bounds.width, 1), 0.22);
    const stretchY = 1 + Math.min(Math.abs(dy) / Math.max(bounds.height, 1), 0.18);

    this.morphAmbientGlow(glows, false);

    this.ambientGlowTween?.kill();
    this.ambientGlowTween = gsap.timeline({ defaults: { duration: 0.55, ease: 'power3.out', overwrite: true } })
      .to(glows[0], {
        x,
        y,
        opacity: 0.8,
        scaleX: stretchX,
        scaleY: 2 - stretchX,
        rotation: (dx / Math.max(bounds.width, 1)) * 26,
      }, 0)
      .to(glows[1], {
        x: x + dx * 0.08,
        y: y + dy * 0.08,
        opacity: 0.54,
        scaleX: 2 - stretchY,
        scaleY: stretchY,
        rotation: (dy / Math.max(bounds.height, 1)) * -22,
      }, 0);
  }

  private flashAmbientGlow(clientX: number, clientY: number, opacity: number, scale: number): void {
    const glows = this.ambientGlowBlobs?.toArray().map((item) => item.nativeElement) ?? [];
    const field = this.ambientField?.nativeElement;
    const view = this.document.defaultView;

    if (glows.length < 2 || !field || view?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const bounds = field.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;

    this.morphAmbientGlow(glows, true);

    this.ambientGlowTween?.kill();
    this.ambientPulseTween?.kill();

    gsap.set(glows[0], {
      x,
      y,
      scaleX: 0.92,
      scaleY: 0.84,
      rotation: 0,
      opacity: Math.max(0.6, opacity - 0.15),
    });
    gsap.set(glows[1], {
      x: x + 18,
      y: y - 14,
      scaleX: 0.84,
      scaleY: 0.92,
      rotation: -6,
      opacity: Math.max(0.45, opacity - 0.28),
    });

    this.ambientPulseTween = gsap.timeline();
    this.ambientPulseTween
      .to(glows[0], { opacity, scaleX: scale * 1.08, scaleY: scale * 0.9, rotation: 10, duration: 0.22, ease: 'power2.out' }, 0)
      .to(glows[1], { opacity: opacity * 0.78, scaleX: scale * 0.96, scaleY: scale * 1.08, rotation: -12, duration: 0.22, ease: 'power2.out' }, 0)
      .to(glows[0], { opacity: 0.74, scaleX: 1, scaleY: 1, rotation: -4, duration: 0.5, ease: 'power3.out' })
      .to(glows[1], { opacity: 0.48, scaleX: 1, scaleY: 1, rotation: 6, duration: 0.5, ease: 'power3.out' }, '<');
  }

  private morphAmbientGlow(glows: HTMLDivElement[], emphasize: boolean): void {
    this.ambientMorphTween?.kill();
    this.ambientMorphTween = gsap.timeline({ defaults: { overwrite: true } })
      .to(glows[0], {
        borderRadius: emphasize
          ? '54% 46% 38% 62% / 41% 57% 43% 59%'
          : '42% 58% 63% 37% / 44% 36% 64% 56%',
        duration: emphasize ? 0.28 : 0.9,
        ease: 'sine.inOut',
      }, 0)
      .to(glows[1], {
        borderRadius: emphasize
          ? '36% 64% 58% 42% / 54% 34% 66% 46%'
          : '48% 52% 39% 61% / 34% 55% 45% 66%',
        duration: emphasize ? 0.28 : 0.9,
        ease: 'sine.inOut',
      }, 0);
  }

}
