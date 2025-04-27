addEventListener('message', (event) => {
  const { startAngle, stopAngle, duration } = event.data;
  const startTime = performance.now();

  // Easing function (no type annotation)
  const easeOutQuad = (t) => t * (2 - t);

  const spin = () => {
    const currentTime = performance.now();
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);

    // Calculate the current angle based on the progress
    const currentAngle = startAngle + (stopAngle - startAngle) * easeOutQuad(progress);

    // Send the progress and current angle back to the main thread
    postMessage({ progress, currentAngle });

    // Continue spinning until the duration is complete
    if (progress < 1) {
      requestAnimationFrame(spin);
    } else {
      postMessage({ progress: 1, completed: true }); // Indicate spin completion
    }
  };

  // Start the spinning process
  spin();
});
