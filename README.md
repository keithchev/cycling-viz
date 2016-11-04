GPS Cycling data visualization
======================

By [Keith Cheveralls](http://kchev.org/) <tt>&lt;[keith.chev@gmail.com](mailto:keith.chev@gmail.com)&gt;</tt><br>
May 2016<br>
See the live version [here](https://keithchev.github.io/cycling-viz/cycling.html) or click below. 

<a href="https://keithchev.github.io/cycling-viz/cycling.html"><img width="600px" src="http://kchev.org/cycling/img/screenshot.PNG" alt="screenshot"></a>

## Introduction
This is a relatively simple interactive visualization of data collected from a GPS cycling computer during a single bike ride.
This data consists of a set of time series, each corresponding to the values of a particular cycling parameter over the course of the ride. These parameters include lat/lon position coordinates, speed, elevation, power output (measured using a power meter), pedaling cadence, and heart rate. 

The lat/lon coordinates are overlaid on OpenStreetMap tiles using Leaflet.js, while the remaining parameters are plotted against elapsed time using d3.js. These plots can be zoomed into by brushing on the topmost elevation plot. Finally, the two-dimensional distribution of all possible pairs of parameters are visualized in a series of scatterplots, also using d3.
