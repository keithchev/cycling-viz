

function loadRide(csv){

            props = definePlotProps();

            csv.forEach(function (row, index) {
              row.dst = row.dst / 1609;  // distance in miles
              row.alt = row.alt * 3.28;  // elevation in feet

              row.cad = +row.cad; // cadence in RPM
              row.pwr = +row.pwr; // power in watts
              row.hrt = +row.hrt; // heart rate in bpm
              row.sec = +row.sec; // elapsed time in seconds
              row.lat = +row.lat;
              row.lon = +row.lon;
            });

            rideData = csv;

            rideData_ = [];

            var SUBSAMPLE_RATE = 5;

            for (i = 0; i < rideData.length; i = i + SUBSAMPLE_RATE) {
              rideData_.push(rideData[i]);
            }

            rideData = rideData_;
            rideData = calcRawSpd(rideData);

            displayInfo(rideData);

            loadButtons(rideData, props);
            
            initMap(rideData);

            // somehow, doLinePlot can modify map and mouseMarker - figure this out
            
            makePlots(rideData, props);

            
        }

        function initMap(rideData) {

          ridePoints = [];

          for (i = 0; i < rideData.length; i+=1) {
            ridePoints.push( [+rideData[i].lat, +rideData[i].lon] );
          }

          var map = L.map('ride-map');

          L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
          maxZoom: 18
          }).addTo(map);

          map.attributionControl.setPrefix(''); // Don't show the 'Powered by Leaflet' text

          // var berkeley = new L.LatLng(37.8, -122.3); // geographical point (longitude and latitude)
          // map.setView(berkeley, 13);

          var lineOptions = {
               color: 'blue',
               weight: 3,
               opacity: 0.7
             };

          var markerOptions = {
              color: 'blue',
              stroke: false,
              fillOpacity: .7,
             };

          var polyline = new L.Polyline(ridePoints, lineOptions);

          map.addLayer(polyline);      

          mouseMarker = new L.circleMarker([+rideData[0].lat, +rideData[0].lon], markerOptions);
          mouseMarker.setRadius(5);                  

           // zoom the map to the polyline
          map.fitBounds(polyline.getBounds());
          map.addLayer(mouseMarker);

        }

        function dictOfListsToListOfDicts(dict) {

          list = [];
          keys = Object.keys(dict);

          for (i = 0; i < dict[keys[0]].length; i++) {
            list[i] = {};
          }

          for (ind in keys) {
            for (i = 0; i < dict[keys[ind]].length; i++) {
              list[i][keys[ind]] = dict[keys[ind]][i];
            }
          }
          return list;
        }

        function listOfDictsToDictOfLists(list) {

          dict = {};
          keys = Object.keys(list[0]);

          for (ind in keys) {
            key = keys[ind];
            dict[key] = [];
            for (i = 0; i < list.length; i++) {
              dict[key][i] = list[i][key];
            }
          }
          return dict;
        }

        function calcRawSpd(rideData) {

          rideData = listOfDictsToDictOfLists(rideData);

          sec = rideData.sec;
          dst = rideData.dst;
          spd = [0];

          for (i = 1; i < sec.length; i++) {
            spd.push( (dst[i] - dst[i-1]) / ( (sec[i] - sec[i-1]) / 3600) ); 
          }

          rideData.spd = spd;

          rideData = dictOfListsToListOfDicts(rideData);

          return rideData;

        }

        function calcElevationGain(rideData) {

          rideData = listOfDictsToDictOfLists(rideData);

          sec = rideData.sec;
          alt = rideData.alt;
          elg = [0];
          vam = [0];

          ds = sec[1] - sec[0];

          for (i = 1; i < sec.length; i++) {

            altChange = alt[i] - alt[i-1];
            altChange = altChange < 0 ? 0 : altChange;

            elg.push( elg[i-1] + altChange );
            vam.push( 3600 * altChange/3.28/ds );
          }

          rideData.elg = elg;
          rideData.vam = vam;

          rideData = dictOfListsToListOfDicts(rideData);

          return rideData;

        }



        function smoothRide(rideData, windowSize) {
          // simple moving-average of ride data (might be slow)

          rideData = listOfDictsToDictOfLists(rideData);

          var datafield, datafieldMA, windowSum;

          var rideDataMA = {};
          var numPoints = rideData.sec.length;

          var keys = Object.keys(rideData);

          for (ind in keys) {
            var key = keys[ind];

            if (key=='sec') { 
              rideDataMA[key] = rideData[key].slice(0, numPoints - windowSize);
              continue; 
            }

            datafield   = rideData[key];
            datafieldMA = [];
            windowSum   = 0;

            for (i = 0; i < (numPoints - windowSize); i++) {
              windowSum = 0;
              for (j = 0; j < windowSize; j++) {
                windowSum += datafield[i + j];
              }
              datafieldMA.push( windowSum / windowSize );

              if (isNaN(windowSum)){ datafieldMA[i] = datafield[i]; }
            }

            rideDataMA[key] = datafieldMA;

          }

          return dictOfListsToListOfDicts(rideDataMA);

        }


        function displayInfo(rideData) {

          rideData = listOfDictsToDictOfLists(rideData);

          d3.select("#info-distance")
          .text(Math.round(10*rideData.dst[rideData.dst.length-1])/10 + ' mi');

          numHours = Math.floor(rideData.sec[rideData.sec.length-1]/3600);
          numMins  = Math.round(-(numHours * 3600 - rideData.sec[rideData.sec.length-1]) / 60);

          d3.select("#info-time")
          .text(numHours + 'h ' + numMins + 'm');
        }

        function makePlots(rideData, props) {

          // this works, but fails if corrected so that this function is called when the smoothing button is clicked - means re-plotting doesn't work
          // this is partially because makeAltPlot doesn't check to see if there's svg in the div
          
            var windowSize = +document.getElementById("text-smoothing-window").value;

            rideData = smoothRide(rideData, windowSize);
            rideData = calcElevationGain(rideData);

            d3.select("#info-elevation-gain").text(Math.round(rideData[rideData.length-1].elg) + ' ft');
          

          var linePlots = [
              makeLinePlot().field('spd'),
              makeLinePlot().field('pwr'),
              makeLinePlot().field('hrt'),
              makeLinePlot().field('cad'),
              makeLinePlot().field('vam'),
          ];

          d3.selectAll(".line-plot")
            .data(linePlots)
            .each(function (linePlot) { d3.select(this).call(linePlot); });

          makeAltPlot(rideData);

          make2DPlot(rideData);


        function makeAltPlot(rideData) {

          props.padB = 20;
          props.plotHeight = 80;

          var div = d3.select("#alt-plot")
                  .attr("height", props.plotHeight + props.padB + props.padB)
                  .attr("width", props.plotWidth + props.padL + props.padR);

          var svg = div.select("svg");
          var firstCall = 0;

          if (svg.empty()) { firstCall = 1; }

          if (firstCall) {
            svg = div.append("svg")
                .attr("height", props.plotHeight + props.padB + props.padB)
                .attr("width", props.plotWidth + props.padL + props.padR)
                .attr("class", "svg-default");

            var altPlot = svg.append("g")
                               .attr("transform", "translate(" + props.padL + "," + props.padT + ")");

            altPlot.append("g")
                .attr("class", "axis")
                .attr("id", "x-axis")
                .attr("transform", "translate(0," + (props.plotHeight) + ")");

            altPlot.append("g")
                 .attr("class", "axis")
                 .attr("id", "y-axis");
              
            altPlot.append("path").attr("id", "alt-area");

          } else {
            var altPlot = svg.select("g");
          }

          var XScale = d3.scale.linear()
                          .range( [0, props.plotWidth])
                          .domain([0, rideData[rideData.length-1].sec]);

          var nSec = rideData[rideData.length-1].sec,
              nFiveMin = nSec / (60 * 5),
              nTicks = 8,
              tickInterval = 300 * Math.floor(nFiveMin / nTicks);

          if (tickInterval==0) { tickInterval = 300; }

          tickValues = [];
          for (i = 0; i < nSec; i = i + tickInterval) {
            tickValues.push(i);
          }

          var XAxis  = d3.svg.axis().scale(XScale).orient("bottom").tickValues(tickValues).tickFormat(formatTicks);

          altPlot.select("#x-axis").call(XAxis);

          var YScaleAlt = d3.scale.linear()
                                  .domain([ d3.min(rideData, function(d) { return d.alt; }),
                                            d3.max(rideData, function(d) { return d.alt; }) ])
                                  .range([props.plotHeight, 0]);

          var areaAlt = d3.svg.area()
                              .x(  function(d) { return XScale(d.sec); })
                              .y1( function(d) { return YScaleAlt(d.alt); })
                              .y0( props.plotHeight );

          var YAxisAlt  = d3.svg.axis().scale(YScaleAlt).orient("left");

          altPlot.select("#y-axis").call(YAxisAlt);

          var brush = d3.svg.brush().x(XScale).on("brush", brushed);

          if (firstCall) {
            altPlot.append("g")
                    .attr("class", "brush")
                    .call(brush)
                    .selectAll("rect")
                    .attr("y", 0)
                    .attr("height", props.plotHeight);
          } else {
            altPlot.select(".brush").call(brush);
          }

          altPlot.select("#alt-area")
             .attr("d", function(d) { return areaAlt(rideData); })
             .attr("stroke-width", 0)
             .attr("fill", "#888")
             .attr("opacity", 0.5);


          function formatTicks(sec) {

            var time = '';

            var h = Math.floor(sec/3600);
            var m = Math.floor( (sec - h*3600)/60 );
            var s = sec - h*3600 - m*60;

            if (h) { time = time + h + "h"; }
            if (m) { time = time + m + "m"; }
            if (s) { time = time + s; }

            return time;

          }


          function brushed() {

            var domain = brush.empty() ? XScale.domain() : brush.extent();

            d3.selectAll(".line-plot").each(function (linePlot) { 
                  d3.select(this).call(linePlot.XDomain(domain)); });
          }
        }

        function makeLinePlot() {

          props = definePlotProps();

          var field, smoothing = 0, XDomain = [],

              N = rideData.length,

              XScale = d3.scale.linear().range([ 0, props.plotWidth ]),
              YScale = d3.scale.linear().range([ props.plotHeight, 0 ]),

              line = d3.svg.line().x(function(d) { return XScale(d.sec); }).interpolate("linear"),

              YAxis = d3.svg.axis().scale(YScale).orient("left").ticks(2),
              XAxis = d3.svg.axis().scale(XScale).orient("bottom");

          function linePlot(div) {

            var svg = div.select("svg");

            if (svg.empty()) {

              svg = div.append("svg")
                       .attr("height", props.plotHeight + props.padB + props.padB)
                       .attr("width", props.plotWidth + props.padL + props.padR)
                       .attr("class", "svg-default");

              svg.append("defs").append("clipPath")
                  .attr("id", "clip")
                  .append("rect")
                  .attr("width", props.plotWidth)
                  .attr("height", props.plotHeight);

              var plot = svg.append("g")
                               .attr("transform", "translate(" + props.padL + "," + props.padT + ")");

              plot.append("g")
                 .attr("class", "axis")
                 .attr("id", "y-axis");

              // y axis label 
              // svg.append("text")
              //    .attr("class", "axis-label")
              //    .attr("id", "y-axis-label")
              //    .attr("text-anchor", "center")
              //    .attr("y", 10)
              //    .attr("x", -props.plotHeight/2 - 20)
              //    .attr("transform", "rotate(-90)")
              //    .text("left axis");

              plot.append("path").attr("class", "line-plot-path").attr("id", "y-axis-path");
              plot.append("path").attr("class", "mouse-position-path");

              // YScale.domain( [ d3.min(rideData, function(d) { return d[field]; }),
              //                  d3.max(rideData, function(d) { return d[field]; })]);

            }

            XScale.domain(XDomain.length ? XDomain : [0, rideData[N-1].sec]);

            YScale.domain( props.YAxisRanges[field] );
          
            line.y(function(d) { return YScale(d[field]); });

            svg.select("#y-axis").call(YAxis);
            
            svg.select("#y-axis-path")
                .attr("d", function(d) { return line(rideData); })
                .attr("stroke", props.plotColors[field])
                .attr("stroke-width", 1)
                .attr("fill", "none");

            svg.on("mousemove", mousemove);


            function mousemove(d, i) {

              var mousePos = d3.mouse(this);
              var divID = d3.select(this.parentNode).attr("id");

              var mouseXPos = mousePos[0] - props.padL;

              dists = [];

              for (i = 0; i < rideData.length; i++) {

                dists.push( Math.pow(mouseXPos - XScale(rideData[i].sec), 2) );
              }

              mousePositionIndex = dists.indexOf(Math.min.apply(Math, dists));

              var mouseLine = d3.svg.line().x(function(d) { return d.x; }).y(function(d) { return d.y; }).interpolate("linear");
              
              var lineData = [ { "x": XScale(rideData[mousePositionIndex].sec), "y": YScale.range()[0] },
                               { "x": XScale(rideData[mousePositionIndex].sec), "y": YScale.range()[1] } ];

              // d3.select(this).select(".mouse-position-path").attr("d", mouseLine(lineData));

              d3.selectAll(".mouse-position-path").attr("d", mouseLine(lineData));

              // copied from make2DPlot for now:
              var XScale2D = d3.scale.linear()
                             .range( [0, props.plotWidth])
                             .domain(props.YAxisRanges.hrt);

              var YScale2D = d3.scale.linear()
                             .domain(props.YAxisRanges.pwr)
                             .range([props.plotHeight, 0]);

              var trailingPath = d3.svg.line().x( function(d) {return XScale2D(d.hrt); })
                                              .y( function(d) {return YScale2D(d.pwr); }).interpolate("linear");

              var trailingPathData = rideData.slice(mousePositionIndex < 10 ? mousePositionIndex : mousePositionIndex - 10, mousePositionIndex);
              
              d3.select("#plot-2d").select("#trailing-mouse-path")
                                   .attr("d", trailingPath(trailingPathData))
                                   .style("stroke", function(d, i) {return d3.rgb(255*i/10, 255*i/10, 255*i/10);});


              // d3.select("#plot-2d").select("#trailing-mouse-path")
              //                      .data(trailingPathData)
              //                      .enter().append("path")
              //                      .attr("d", trailingPath)
              //                      .style("fill", function(d, i) {return d3.rgb(255*i/10, 255*i/10, 255*i/10);})
              //                      .style("stroke", function(d, i) {return d3.rgb(255*i/10, 255*i/10, 255*i/10);});


              mouseMarker.setLatLng([ +rideData[mousePositionIndex].lat, +rideData[mousePositionIndex].lon ]);
              mouseMarker.setRadius(  +rideData[mousePositionIndex].alt/100 );

              d3.select("#alt-title").text(rideData[mousePositionIndex].alt.toFixed(0));
              d3.select("#spd-title").text(rideData[mousePositionIndex].spd.toFixed(2));
              d3.select("#pwr-title").text(rideData[mousePositionIndex].pwr.toFixed(0));
              d3.select("#hrt-title").text(rideData[mousePositionIndex].hrt.toFixed(0));
              d3.select("#cad-title").text(rideData[mousePositionIndex].cad.toFixed(0));
              d3.select("#vam-title").text(rideData[mousePositionIndex].vam.toFixed(0));
            }

          }


          linePlot.field = function(val) {
            if (!arguments.length) return field;
            field = val;
            return linePlot;
          }

          linePlot.XDomain = function(val) {
            if(!arguments.length) return XDomain;
            XDomain = val;
            return linePlot;
          }

          linePlot.smoothing = function(val) {
            if (!arguments.length) return smoothing;
            smoothing = val;
            return linePlot;
          }

          return linePlot;
        }


        function make2DPlot(rideData) {

          props.padB = 20;
          props.plotHeight = 300;
          props.plotWidth  = 400;

          var div = d3.select("#plot-2d")
                  .attr("height", props.plotHeight + props.padB + props.padB)
                  .attr("width",  props.plotWidth + props.padL + props.padR);

          var svg = div.select("svg");
          var firstCall = 0;

          if (svg.empty()) { firstCall = 1; }

          if (firstCall) {
            svg = div.append("svg")
                .attr("height", props.plotHeight + props.padB + props.padB)
                .attr("width", props.plotWidth + props.padL + props.padR)
                .attr("class", "svg-default");

            var plot2D = svg.append("g")
                               .attr("transform", "translate(" + props.padL + "," + props.padT + ")");

            plot2D.append("g")
                .attr("class", "axis")
                .attr("id", "x-axis")
                .attr("transform", "translate(0," + (props.plotHeight) + ")");

            plot2D.append("g")
                 .attr("class", "axis")
                 .attr("id", "y-axis");

            plot2D.append("path").attr("id", "trailing-mouse-path")
                                 .style("fill", "none")
                                 .style("stroke", "#333")
                                 .style("stroke-width", "2");


          plot2D.append("text")
            .attr("class", "axis-label")
            .attr("id", "x-axis-label")
            .attr("text-anchor", "center")
            .attr("x", props.plotWidth/2-15)
            .attr("y", props.plotHeight + props.padB+5)
            .text("Heart rate (bpm)");

         plot2D.append("text")
            .attr("class", "axis-label")
            .attr("id", "y-axis-label")
            .attr("text-anchor", "center")
            .attr("x", -props.plotHeight/2 - 15 )
            .attr("y",  -props.padL - 5)
            .attr("transform", "rotate(-90)")
            .text("Power (Watts)");
              
          } else {
            var plot2D = svg.select("g");
          }

          var XScale = d3.scale.linear()
                         .range( [0, props.plotWidth])
                         .domain(props.YAxisRanges.hrt);

          var YScale = d3.scale.linear()
                         .domain(props.YAxisRanges.pwr)
                         .range([props.plotHeight, 0]);

          var color = d3.scale.linear().domain(props.YAxisRanges.spd)
                                        .range(["steelblue", "red"]);

          var XAxis  = d3.svg.axis().scale(XScale).orient("bottom");
          var YAxis  = d3.svg.axis().scale(YScale).orient("left");

          plot2D.select("#x-axis").call(XAxis);
          plot2D.select("#y-axis").call(YAxis);

          nSec = rideData[rideData.length-1].sec;

          plot2D.selectAll(".scatter-plot-dot")
                .data(rideData)
                .enter().append("circle")
                .attr("class", "scatter-plot-dot")
                .attr("r", 3)
                .attr("cx", function(d){ return XScale(d.hrt); })
                .attr("cy", function(d){ return YScale(d.pwr); })
                .style("fill", function(d){ return color(d.spd); })
                .style("fill-opacity", ".7");


        }


        
}

        function loadButtons(rideData, props) {

          setButtonStyle("#button-x-axis", props.xAxIsTimeFlag);

            d3.select("#button-x-axis").on("click.position", function () {
              props.xAxIsTimeFlag = !props.xAxIsTimeFlag;
              setButtonStyle(this, props.xAxIsTimeFlag);
              makePlots(rideData, props);       
            });

            d3.select("#button-smoothing").on("click.position", function() {
              // props.doSmoothingFlag = !props.doSmoothingFlag;
              // setButtonStyle(this, props.doSmoothingFlag);
              makePlots(rideData, props);
            });

            d3.select("#button-pwr").on("click.position", function() {
            });

            d3.select("#button-cad").on("click.position", function() {
            });
        }

        function setButtonStyle(obj, flag) {

          if (flag) {
            d3.select(obj).style("font-weight", "bold");
          }
          if (!flag) {
            d3.select(obj).style("font-weight", "normal");
          }
        }


        function definePlotProps() {


            var YAxisRanges = {
              spd: [0, 40], 
              pwr: [0, 420],
              hrt: [80, 185],
              cad: [40, 100],
              vam: [0, 1600],
            };

            var plotColors = {
              spd: "rgb(30, 190, 30)",
              pwr: "rgb(250, 80, 30)",
              hrt: "rgb(30, 80, 200)",
              cad: "rgb(220, 20, 190)",
              vam: "rgb(80, 80, 80)",
            };

            var props = {
                padL: 35, padR: 10,
                padT: 10, padB: 10,
                plotWidth:  500, 
                plotHeight: 50,
                xAxIsTimeFlag: 0,
                doSmoothingFlag: 0,
                plotPwr: 0,
                plotCad: 0,
                YAxisRanges: YAxisRanges,
                plotColors: plotColors,
            };

            return props;
        }