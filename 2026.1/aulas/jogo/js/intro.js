/* ===== INTRODUÇÃO — Onboarding Logic ===== */

(function () {
    "use strict";

    var currentSlide = 0;
    var totalSlides = document.querySelectorAll(".intro-slide").length;
    var slides = document.querySelectorAll(".intro-slide");
    var dots = document.querySelectorAll(".intro-dot");
    var prevBtn = document.getElementById("prev-btn");
    var nextBtn = document.getElementById("next-btn");
    var progressEl = document.getElementById("progress-text");
    var isTransitioning = false;

    /* ===== SLIDE NAVIGATION ===== */
    function goToSlide(index) {
        if (index < 0 || index >= totalSlides) return;
        if (index === currentSlide) return;
        if (isTransitioning) return;

        isTransitioning = true;

        var oldSlide = currentSlide;
        var oldSlideEl = slides[oldSlide];
        var nextSlideEl = slides[index];
        var forward = index > oldSlide;

        // Exit current slide
        oldSlideEl.style.transform = "";
        oldSlideEl.style.opacity = "";
        oldSlideEl.classList.remove("active");
        oldSlideEl.classList.add("exit-left");

        // Remove exit class from the slide that just exited
        setTimeout(function () {
            oldSlideEl.classList.remove("exit-left");
        }, 550);

        // Activate new slide
        currentSlide = index;

        // Direction handling
        nextSlideEl.classList.remove("active", "exit-left");
        nextSlideEl.style.transition = "none";
        if (forward) {
            nextSlideEl.style.transform = "translateX(80px)";
        } else {
            nextSlideEl.style.transform = "translateX(-80px)";
        }
        nextSlideEl.style.opacity = "0";

        // Force reflow
        void nextSlideEl.offsetWidth;

        nextSlideEl.style.transition = "";
        nextSlideEl.classList.add("active");
        nextSlideEl.style.transform = "";
        nextSlideEl.style.opacity = "";

        updateControls();
        runSlideAnimations(currentSlide);

        setTimeout(function () {
            isTransitioning = false;
        }, 560);
    }

    function updateControls() {
        // Dots
        dots.forEach(function (dot, i) {
            dot.classList.remove("active", "completed");
            if (i === currentSlide) {
                dot.classList.add("active");
            } else if (i < currentSlide) {
                dot.classList.add("completed");
            }
        });

        // Progress text
        progressEl.textContent = (currentSlide + 1) + " de " + totalSlides;

        // Buttons
        prevBtn.disabled = currentSlide === 0;

        // Last slide: change next button
        if (currentSlide === totalSlides - 1) {
            nextBtn.style.display = "none";
        } else {
            nextBtn.style.display = "";
        }
    }

    prevBtn.addEventListener("click", function () {
        goToSlide(currentSlide - 1);
    });

    nextBtn.addEventListener("click", function () {
        goToSlide(currentSlide + 1);
    });

    /* ===== KEYBOARD NAVIGATION ===== */
    document.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === " ") {
            e.preventDefault();
            if (currentSlide < totalSlides - 1) goToSlide(currentSlide + 1);
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            if (currentSlide > 0) goToSlide(currentSlide - 1);
        }
    });

    /* ===== SWIPE SUPPORT ===== */
    var touchStartX = 0;
    var container = document.querySelector(".intro-container");

    container.addEventListener("touchstart", function (e) {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    container.addEventListener("touchend", function (e) {
        var diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentSlide < totalSlides - 1) {
                goToSlide(currentSlide + 1);
            } else if (diff < 0 && currentSlide > 0) {
                goToSlide(currentSlide - 1);
            }
        }
    }, { passive: true });

    /* ===== SLIDE ANIMATIONS ===== */
    function runSlideAnimations(slideIndex) {
        // Slide 7: animated player demo (data-slide="6")
        if (slideIndex === 6) {
            animatePlayerDemo();
        }
    }

    /* ===== ANIMATED DEMO (Slide 6) ===== */
    function animatePlayerDemo() {
        var demoPlayer = document.getElementById("demo-player");
        if (!demoPlayer) return;

        var cells = document.querySelectorAll("#demo-track .demo-cell");
        var step = 0;
        var positions = [0, 1, 2, 3, 4]; // cells to visit

        // Reset
        demoPlayer.style.left = "14px";
        step = 0;

        var cellWidth = cells[0] ? cells[0].offsetWidth : 56;

        function nextStep() {
            if (step >= positions.length - 1) {
                // Restart after delay
                setTimeout(function () {
                    step = 0;
                    demoPlayer.style.transition = "none";
                    demoPlayer.style.left = "14px";
                    void demoPlayer.offsetWidth;
                    demoPlayer.style.transition = "";
                    setTimeout(nextStep, 800);
                }, 2000);
                return;
            }

            step++;
            var newLeft = positions[step] * cellWidth + 14;
            demoPlayer.style.left = newLeft + "px";

            // Highlight current command
            var cmdLines = document.querySelectorAll("#demo-commands .demo-cmd-line");
            cmdLines.forEach(function (el, i) {
                el.classList.toggle("active", i === step - 1);
            });

            setTimeout(nextStep, 900);
        }

        setTimeout(nextStep, 800);
    }

    /* ===== INIT ===== */
    updateControls();

})();
