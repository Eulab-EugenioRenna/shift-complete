import { Component, AfterViewInit, ElementRef, ViewChild, ViewChildren, QueryList, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing-page.component.html',
})
export class LandingPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('heroTitle') heroTitle!: ElementRef;
  @ViewChild('heroDesc') heroDesc!: ElementRef;
  @ViewChild('heroButtons') heroButtons!: ElementRef;
  @ViewChildren('featureCard') featureCards!: QueryList<ElementRef>;
  @ViewChild('demoSection') demoSection!: ElementRef;

  ngAfterViewInit() {
    // Initial hero animations
    const tl = gsap.timeline();
    
    tl.from(this.heroTitle.nativeElement, {
      y: 50,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
    })
    .from(this.heroDesc.nativeElement, {
      y: 30,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    }, '-=0.6')
    .from(this.heroButtons.nativeElement, {
      y: 30,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    }, '-=0.6');

    // ScrollTrigger animations for feature cards
    this.featureCards.forEach((card, i) => {
      gsap.from(card.nativeElement, {
        scrollTrigger: {
          trigger: card.nativeElement,
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        },
        y: 60,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        delay: i * 0.1
      });
    });

    // Demo Section Parallax / Fade in
    gsap.from(this.demoSection.nativeElement, {
      scrollTrigger: {
        trigger: this.demoSection.nativeElement,
        start: 'top 80%',
        toggleActions: 'play none none reverse'
      },
      scale: 0.95,
      opacity: 0,
      duration: 1,
      ease: 'power2.out'
    });
  }

  ngOnDestroy() {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }
}
