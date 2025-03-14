self.onmessage = function (e) {
  console.log("Worker: Received image data");
  const { imageData, width, height } = e.data;
  const data = imageData.data;
  const contours = [];
  const threshold = 30; // Color threshold for grouping similar colors
  const visited = new Set();

  // Utility function to get pixel color
  function getPixel(x, y) {
    const index = (y * width + x) * 4;
    return { r: data[index], g: data[index + 1], b: data[index + 2] };
  }

  // Utility function to calculate the Euclidean distance between two colors
  function colorDistance(c1, c2) {
    return Math.sqrt(
      (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2
    );
  }

  // Function for k-means color quantization
  function kMeansQuantization(k, colors) {
    let centroids = colors.slice(0, k);
    let prevCentroids = new Array(k).fill({ r: 0, g: 0, b: 0 });

    while (true) {
      // Create clusters based on the current centroids
      const clusters = new Array(k).fill().map(() => []);
      for (let color of colors) {
        let closestCentroidIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < k; i++) {
          let dist = colorDistance(color, centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            closestCentroidIdx = i;
          }
        }
        clusters[closestCentroidIdx].push(color);
      }

      // Recalculate centroids
      let hasConverged = true;
      for (let i = 0; i < k; i++) {
        let cluster = clusters[i];
        let newCentroid = { r: 0, g: 0, b: 0 };
        for (let color of cluster) {
          newCentroid.r += color.r;
          newCentroid.g += color.g;
          newCentroid.b += color.b;
        }
        newCentroid.r /= cluster.length;
        newCentroid.g /= cluster.length;
        newCentroid.b /= cluster.length;

        if (colorDistance(newCentroid, centroids[i]) > 1) {
          hasConverged = false;
        }
        centroids[i] = newCentroid;
      }

      if (hasConverged) break;
    }
    return centroids;
  }

  // Function to simplify the contour path using Ramer-Douglas-Peucker algorithm
  function simplifyPath(points, tolerance) {
    if (points.length <= 2) return points;

    const getPerpendicularDistance = (point, lineStart, lineEnd) => {
      const A = point[1] - lineStart[1];
      const B = lineStart[0] - point[0];
      const C = point[0] * lineStart[1] - lineStart[0] * point[1];
      return (
        Math.abs(A * lineEnd[0] + B * lineEnd[1] + C) / Math.sqrt(A * A + B * B)
      );
    };

    const recursiveSimplify = (start, end) => {
      let maxDist = 0;
      let index = -1;
      for (let i = start + 1; i < end; i++) {
        const dist = getPerpendicularDistance(
          points[i],
          points[start],
          points[end]
        );
        if (dist > maxDist) {
          maxDist = dist;
          index = i;
        }
      }

      if (maxDist > tolerance) {
        const left = recursiveSimplify(start, index);
        const right = recursiveSimplify(index, end);
        return [...left.slice(0, -1), ...right];
      } else {
        return [points[start], points[end]];
      }
    };

    return recursiveSimplify(0, points.length - 1);
  }

  // Helper function to smooth the contour path with cubic Bezier curves
  function smoothPath(points) {
    if (points.length < 3) return points.join(" ");
    let path = `M${points[0][0]} ${points[0][1]}`;

    for (let i = 1; i < points.length - 2; i++) {
      let p0 = points[i - 1];
      let p1 = points[i];
      let p2 = points[i + 1];
      let p3 = points[i + 2];

      let cx = (p0[0] + p3[0]) / 2;
      let cy = (p0[1] + p3[1]) / 2;

      // Cubic Bezier control points
      path += ` C${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${cx} ${cy}`;
    }

    path += ` L${points[points.length - 1][0]} ${
      points[points.length - 1][1]
    } Z`;
    return path;
  }

  // Function to trace a contour
  function traceContour(startX, startY, color) {
    console.log(`Tracing contour at (${startX}, ${startY})`);
    let points = [[startX, startY]];
    let directions = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ];
    let x = startX,
      y = startY;
    let steps = 0;
    const maxSteps = 5000;

    do {
      if (steps++ > maxSteps) {
        console.warn("Contour tracing exceeded step limit");
        break;
      }
      for (let [dx, dy] of directions) {
        let newX = x + dx,
          newY = y + dy;
        if (newX >= 0 && newY >= 0 && newX < width && newY < height) {
          let newColor = getPixel(newX, newY);
          if (
            colorDistance(newColor, color) < threshold &&
            !visited.has(`${newX},${newY}`)
          ) {
            visited.add(`${newX},${newY}`);
            points.push([newX, newY]);
            x = newX;
            y = newY;
            break;
          }
        }
      }
    } while (x !== startX || y !== startY);

    // Simplify the path and smooth it
    points = simplifyPath(points, 2); // Tolerance for simplification
    return smoothPath(points);
  }

  // Get all the colors from the image
  let colors = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      colors.push(getPixel(x, y));
    }
  }

  // Apply color quantization to reduce color variety
  let k = 8; // Number of color clusters
  let quantizedColors = kMeansQuantization(k, colors);

  // Start the contour detection process
  console.log("Worker: Starting contour detection");
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = getPixel(x, y);

      // Find the closest quantized color
      let closestColor = quantizedColors.reduce((closest, centroid) => {
        return colorDistance(color, centroid) < colorDistance(color, closest)
          ? centroid
          : closest;
      }, quantizedColors[0]);

      if (!visited.has(`${x},${y}`)) {
        visited.add(`${x},${y}`);
        let path = traceContour(x, y, closestColor);
        contours.push({
          path,
          color: `rgb(${closestColor.r},${closestColor.g},${closestColor.b})`,
        });
      }
    }
  }

  console.log(
    "Worker: Contour detection completed. Sending message to main thread."
  );
  self.postMessage({ contours, width, height });
};
