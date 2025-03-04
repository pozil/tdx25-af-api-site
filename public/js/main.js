class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.messageListeners = [];
  }

  connect() {
    // Open connection
    console.log("WS opening ", this.url);
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener("open", () => {
      console.log("WS open");
      this.heartbeat();
    });

    // Listen for messages while filtering ping messages
    this.ws.addEventListener("message", (event) => {
      const eventData = JSON.parse(event.data);
      if (eventData.type === "ping") {
        this.ws.send('{ "type" : "pong" }');
        this.heartbeat();
      } else {
        this.messageListeners.forEach((listener) => {
          listener(eventData);
        });
      }
    });

    // Listen for errors
    this.ws.addEventListener("error", (event) => {
      console.error("WS error", event);
    });

    this.ws.addEventListener("close", () => {
      clearTimeout(this.pingTimeout);
      console.info("WS connection closed");
    });
  }

  addMessageListener(listener) {
    this.messageListeners.push(listener);
  }

  heartbeat() {
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      this.ws.close();
      console.warn("WS connection closed after timeout. Reconnecting.");
      this.connect();
    }, 30000 + 1000);
  }

  send(message) {
    this.ws.send(message);
  }
}

(function ($) {
  "use strict";

  // Spinner
  var spinner = function () {
    setTimeout(function () {
      if ($("#spinner").length > 0) {
        $("#spinner").removeClass("show");
      }
    }, 1);
  };
  spinner();

  // Initiate the wowjs
  new WOW().init();

  // Sticky Navbar
  $(window).scroll(function () {
    if ($(this).scrollTop() > 300) {
      $(".sticky-top").css("top", "0px");
    } else {
      $(".sticky-top").css("top", "-100px");
    }
  });

  // Dropdown on mouse hover
  const $dropdown = $(".dropdown");
  const $dropdownToggle = $(".dropdown-toggle");
  const $dropdownMenu = $(".dropdown-menu");
  const showClass = "show";

  $(window).on("load resize", function () {
    if (this.matchMedia("(min-width: 992px)").matches) {
      $dropdown.hover(
        function () {
          const $this = $(this);
          $this.addClass(showClass);
          $this.find($dropdownToggle).attr("aria-expanded", "true");
          $this.find($dropdownMenu).addClass(showClass);
        },
        function () {
          const $this = $(this);
          $this.removeClass(showClass);
          $this.find($dropdownToggle).attr("aria-expanded", "false");
          $this.find($dropdownMenu).removeClass(showClass);
        }
      );
    } else {
      $dropdown.off("mouseenter mouseleave");
    }
  });

  // Back to top button
  $(window).scroll(function () {
    if ($(this).scrollTop() > 300) {
      $(".back-to-top").fadeIn("slow");
    } else {
      $(".back-to-top").fadeOut("slow");
    }
  });
  $(".back-to-top").click(function () {
    $("html, body").animate({ scrollTop: 0 }, 1500, "easeInOutExpo");
    return false;
  });

  // Header carousel
  $(".header-carousel").owlCarousel({
    autoplay: false,
    smartSpeed: 1500,
    items: 1,
    dots: false,
    loop: true,
    nav: true,
    navText: [
      '<i class="bi bi-chevron-left"></i>',
      '<i class="bi bi-chevron-right"></i>',
    ],
  });

  // Testimonials carousel
  $(".testimonial-carousel").owlCarousel({
    autoplay: true,
    smartSpeed: 1000,
    center: true,
    margin: 24,
    dots: true,
    loop: true,
    nav: false,
    responsive: {
      0: {
        items: 1,
      },
      768: {
        items: 2,
      },
      992: {
        items: 3,
      },
    },
  });
})(jQuery);

// Toggle help me decide
document.querySelector("h6.collapsible")?.addEventListener("click", (event) => {
  const icon = event.target.querySelector("i.fas");
  icon.classList.toggle("fa-chevron-right");
  icon.classList.toggle("fa-chevron-down");
});

// Load courses
async function loadCourses() {
  const courseContainer = document.querySelector("#courses-container");
  if (!courseContainer) {
    return;
  }
  const courseTemplate = document.querySelector("#course-template>div");
  const courseData = await fetch("/data/courses.json");
  const courses = await courseData.json();
  const TEXT_PROPS = [
    "title",
    "reviewers",
    "instructor",
    "duration",
    "capacity",
    "price",
  ];
  for (let i = 0; i < 12; i++) {
    const course = courses[i];
    const clone = courseTemplate.cloneNode(true);
    TEXT_PROPS.forEach((prop) => {
      clone.querySelector(`.course-${prop}`).textContent = course[prop];
    });
    if (course.isFavorite) {
      const favBtnEl = clone.querySelector(".course-favorite-icon");
      favBtnEl.classList.remove("text-secondary");
      favBtnEl.classList.add("text-primary");
    }
    if (course.stars !== 5) {
      const starEl = clone.querySelectorAll(".fa-star")[4];
      starEl.classList.remove("text-primary");
      starEl.classList.add("text-secondary");
    }
    clone.querySelector(".course-image").src = `img/courses/${course.id}.jpeg`;
    courseContainer.appendChild(clone);
  }
  // Add favorite helper
  document.querySelectorAll(".course-favorite-icon").forEach(favBtnEl => {
    favBtnEl.addEventListener('click', handleFavoriteClick);
  });
}

function handleFavoriteClick(event) {
  // Update fav icon
  const favBtnEl = event.target;
  favBtnEl.classList.toggle('text-primary');
  favBtnEl.classList.toggle('text-secondary');
  // Run prompt
  const prompt = 'Give me a summary of the "Discover Generative AI" course';
  console.log(`Sending user prompt: ${prompt}`);
  const message = { type: "sync-prompt", prompt };
  ws.send(JSON.stringify(message));
}

// Handle WebSocket messages
function handleWsMessage(message) {
  console.log(message);
  switch (message.type) {
    // Handle async prompt response
    case 'async-prompt-response':
      const promptMessageType = message.data.message.type;
      switch (promptMessageType) {
        case "ProgressIndicator":
          const loadingMessageEl = document.querySelector(".loading-message");
          loadingMessageEl.innerText = `${message.data.message.message}...`;
          break;
        case "Inform":
          const textEl = document.createElement("DIV");
          const formattedMessage = (message.data.message.message +'\n')
            .replaceAll(/(\d\. )(.+)\n/gm, '$1<a href="#">$2</a>\n')
            .replaceAll(`\n`, "<br/>")
            .replaceAll("   ", "&emsp;");
          textEl.innerHTML = formattedMessage;
          document.querySelector("#prompt-response").appendChild(textEl);
          break;
        case "EndOfTurn":
          $(".course-finder-form-spinner").fadeOut().addClass("d-none");
          document.querySelector("#resume-search").classList.toggle("d-none");
          break;
      }
      break;
    // Handle sync prompt response
    case 'sync-prompt-response':
      // Display response as a toast
      console.log(message.data);
      const toastEl = document.querySelector('#liveToast');
      toastEl.querySelector('.toast-body').innerHTML = message.data +'<br/>Click <a href="#">here</a> for similar courses.';
      const toast = new bootstrap.Toast(toastEl, { autohide: false });
      toast.show();
      break;
  }
}

// Form submission
document
  .querySelector("form.course-finder-form")
  ?.addEventListener("submit", (event) => {
    // Disable form
    event.preventDefault();
    const form = event.target;
    form.querySelector("button[type='submit']").disabled = true;
    form.querySelector("input[type='checkbox']").disabled = true;
    const promptEl = form.querySelector("textarea");
    promptEl.disabled = true;

    // Display spinner
    $(form).fadeOut();
    $(".course-finder-form-spinner").fadeIn().removeClass("d-none");

    // Run prompt
    console.log(`Sending user prompt: ${promptEl.value}`);
    const message = { type: "async-prompt", prompt: promptEl.value };
    ws.send(JSON.stringify(message));
  });

const resumeSearchButton = document.querySelector("#resume-search");
resumeSearchButton?.addEventListener("click", (event) => {
  resumeSearchButton.classList.toggle("d-none");
  const form = document.querySelector("form.course-finder-form");
  $(form).fadeIn();
  form.querySelector("button[type='submit']").disabled = false;
  form.querySelector("input[type='checkbox']").disabled = false;
  const promptEl = form.querySelector("textarea");
  promptEl.disabled = false;
  promptEl.value = "";
  document.querySelector("#prompt-response").childNodes.forEach(node => node.remove());
});

// Load courses
loadCourses();
// Connect WebSocket
const ws = new WebSocketClient("/websockets");
ws.connect();
ws.addMessageListener(handleWsMessage);
