/* ===== HOME PAGE — JavaScript ===== */

document.addEventListener("DOMContentLoaded", () => {
    /* ===== ESTRELAS ANIMADAS ===== */
    const starsContainer = document.querySelector(".stars-container");
    if (starsContainer) {
        const starCount = 80;
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement("div");
            star.classList.add("star");
            star.style.left = Math.random() * 100 + "%";
            star.style.top = Math.random() * 100 + "%";
            star.style.setProperty("--duration", (2 + Math.random() * 4) + "s");
            star.style.setProperty("--delay", (Math.random() * 5) + "s");

            const size = 1 + Math.random() * 3;
            star.style.width = size + "px";
            star.style.height = size + "px";

            starsContainer.appendChild(star);
        }
    }

    /* ===== HEADER SCROLL EFFECT ===== */
    const header = document.querySelector(".home-header");
    if (header) {
        window.addEventListener("scroll", () => {
            if (window.scrollY > 50) {
                header.style.background = "rgba(8, 14, 26, 0.95)";
                header.style.borderBottomColor = "rgba(255, 255, 255, 0.1)";
            } else {
                header.style.background = "rgba(8, 14, 26, 0.75)";
                header.style.borderBottomColor = "rgba(255, 255, 255, 0.06)";
            }
        });
    }

    /* ===== SCROLL REVEAL DAS FASES ===== */
    const phaseNodes = document.querySelectorAll(".phase-node");
    const moduleDividers = document.querySelectorAll(".module-divider");

    if (phaseNodes.length > 0) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = "1";
                        entry.target.style.transform = "translateX(0) translateY(0)";
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15 }
        );

        phaseNodes.forEach((node) => {
            const isRight = node.classList.contains("phase-right");
            node.style.opacity = "0";
            node.style.transform = isRight ? "translateX(40px)" : "translateX(-40px)";
            node.style.transition = "all 0.7s cubic-bezier(0.4, 0, 0.2, 1)";
            observer.observe(node);
        });

        // Module dividers
        moduleDividers.forEach((div) => {
            div.style.opacity = "0";
            div.style.transform = "translateY(20px)";
            div.style.transition = "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
            observer.observe(div);
        });
    }

    /* ===== SCROLL REVEAL DOS FEATURE CARDS ===== */
    const featureCards = document.querySelectorAll(".feature-card");
    if (featureCards.length > 0) {
        const featObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = "1";
                        entry.target.style.transform = "translateY(0)";
                        featObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.2 }
        );

        featureCards.forEach((card, index) => {
            card.style.opacity = "0";
            card.style.transform = "translateY(20px)";
            card.style.transition = `all 0.5s ${index * 0.1}s cubic-bezier(0.4, 0, 0.2, 1)`;
            featObserver.observe(card);
        });
    }

    /* ===== SMOOTH SCROLL PARA LINKS INTERNOS ===== */
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (e) => {
            const target = document.querySelector(link.getAttribute("href"));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
});
