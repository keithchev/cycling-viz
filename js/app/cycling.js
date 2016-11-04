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

          debugger;

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

        function calcMeanOverDomain(rideData, field, domain) {

          rideData = listOfDictsToDictOfLists(rideData);

          sec = rideData.sec;

          range = [];

          for (n = 0; n < domain.length; n++) {
            dists = [];
            for (i = 0; i < sec.length; i++) {
              dists.push( Math.abs(sec[i] - domain[n]) );
            }
            range.push(dists.indexOf(Math.min.apply(Math, dists)));
          }

          fieldData = rideData[field].slice(range[0], range[1]);

          return fieldData.reduce(function(x1, x2) { return x1 + x2; }) / fieldData.length;
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
          dst = rideData.dst;
          elg = [0];
          vam = [0];
          slp = [0];

          dsec = sec[1] - sec[0];

          for (i = 1; i < sec.length; i++) {

            dAlt = alt[i] - alt[i-1];
            // dAlt = dAlt < 0 ? 0 : dAlt;

            dDst = dst[i] - dst[i-1];


            elg.push( elg[i-1] + dAlt );
            vam.push( 3600 * dAlt/3.28/dsec ); // in meters per hour

            if ( dDst == 0 ) {
              slp.push(0);
            } else {
              slp.push( 100*(alt[i] - alt[i-1]) / (dDst * 5280) );
            }
          }

          rideData.elg = elg;
          rideData.vam = vam;
          rideData.slp = slp;

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

          d3.select("#info-time").text(numHours + 'h ' + numMins + 'm');
        }

        function makePlots(rideData, props) {
          
          var windowSize = +document.getElementById("text-smoothing-window").value;

          var fields = ['spd', 'pwr', 'hrt', 'cad', 'vam', 'slp'];

          var fields2d = [ ['pwr', 'spd'], ['hrt', 'spd'], ['cad', 'spd'], ['vam', 'spd'], ['slp', 'spd'],
                           ['pwr', 'hrt'], ['hrt', 'cad'], ['cad', 'vam'], ['vam', 'slp'], ['',''],       
                           ['pwr', 'cad'], ['hrt', 'vam'], ['cad', 'slp'], ['',''],        ['',''],                           
                           ['pwr', 'vam'], ['hrt', 'slp'], ['',''],        ['',''],        ['',''],
                           ['pwr', 'slp'], ['',''],        ['',''],        ['',''],        ['',''], ]; 


           fields2d = [ ['hrt', 'pwr'], ['pwr', 'spd'], ['pwr', 'vam'], ['cad', 'spd'], ['slp', 'spd'], ['slp', 'vam'],];

          rideData = smoothRide(rideData, windowSize);
          rideData = calcElevationGain(rideData);

          d3.select("#info-elevation-gain").text(Math.round(rideData[rideData.length-1].elg) + ' ft');

          var linePlots = [];
          fields.forEach( function(field) {linePlots.push(makeLinePlot().field(field));} );

          d3.select("#plots-1d-container")
            .selectAll("div")
            .data(linePlots)
            .enter().append("div")
            .attr("class", "line-plot-container");

          d3.selectAll(".line-plot-container")
            .data(linePlots)
            .each(function (linePlot) { d3.select(this).call(linePlot); });


          var scatterPlots = [];
          fields2d.forEach( function(field2d) {scatterPlots.push(makeScatterPlot().field(field2d));} );

          d3.select("#plots-2d-container")
            .selectAll("div")
            .data(scatterPlots)
            .enter().append("div")
            .attr("class", "scatter-plot-container");

          d3.selectAll(".scatter-plot-container")
            .data(scatterPlots)
            .each(function (scatterPlot) {d3.select(this).call(scatterPlot); });

          makeAltPlot(rideData);
          
          }

        function makeAltPlot(rideData) {

          props.padB = 20;
          props.linePlotHeight = 80;

          var div = d3.select("#alt-plot")
                  .attr("height", props.linePlotHeight + props.padB + props.padB)
                  .attr("width", props.linePlotWidth + props.padL + props.padR);

          var svg = div.select("svg");
          var firstCall = 0;

          if (svg.empty()) { firstCall = 1; }

          if (firstCall) {
            svg = div.append("svg")
                .attr("height", props.linePlotHeight + props.padB + props.padB)
                .attr("width", props.linePlotWidth + props.padL + props.padR)
                .attr("class", "svg-default");

            var altPlot = svg.append("g")
                               .attr("transform", "translate(" + props.padL + "," + props.padT + ")");

            altPlot.append("g")
                .attr("class", "axis")
                .attr("id", "x-axis")
                .attr("transform", "translate(0," + (props.linePlotHeight) + ")");

            altPlot.append("g")
                 .attr("class", "axis")
                 .attr("id", "y-axis");
              
            altPlot.append("path").attr("id", "alt-area");

          } else { var altPlot = svg.select("g"); }

          var XScale = d3.scale.linear()
                          .range( [0, props.linePlotWidth])
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
                                  .range([props.linePlotHeight, 0]);

          var areaAlt = d3.svg.area()
                              .x(  function(d) { return XScale(d.sec); })
                              .y1( function(d) { return YScaleAlt(d.alt); })
                              .y0( props.linePlotHeight );

          var YAxisAlt  = d3.svg.axis().scale(YScaleAlt).orient("left").ticks(5);

          altPlot.select("#y-axis").call(YAxisAlt);

          var brush = d3.svg.brush().x(XScale).on("brush", brushed);

          if (firstCall) {
            altPlot.append("g")
                    .attr("class", "brush")
                    .call(brush)
                    .selectAll("rect")
                    .attr("y", 0)
                    .attr("height", props.linePlotHeight);
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

            d3.selectAll(".line-plot-container").each(function (linePlot) { 
                  d3.select(this).call(linePlot.XDomain(domain)); });
          }
        }

        function makeLinePlot() {

          props = definePlotProps();

          rideData = calcElevationGain(rideData);


          var field, smoothing = 0, XDomain = [],

          N = rideData.length,

          XScale = d3.scale.linear().range([ 0, props.linePlotWidth ]),
          YScale = d3.scale.linear().range([ props.linePlotHeight, 0 ]),

          line = d3.svg.line().x(function(d) { return XScale(d.sec); }).interpolate("linear"),

          YAxis = d3.svg.axis().scale(YScale).orient("left"),
          XAxis = d3.svg.axis().scale(XScale).orient("bottom");

          var meanLine = d3.svg.line().x(function(d) { return d.x; }).y(function(d) { return d.y; }).interpolate("linear");

          function linePlot(div) {

            var svg = div.select("svg");

            if (svg.empty()) {

              div.append("div").attr("class", "plot-title");

              div.select(".plot-title").append("div").attr("class", "plot-title-value");
              div.select(".plot-title").append("div").attr("class", "plot-title-units").text( props.units[field] );

              svg = div.append("div").attr("class", "line-plot").append("svg");

              svg.attr("height", props.linePlotHeight + props.padB + props.padB)
                 .attr("width", props.linePlotWidth + props.padL + props.padR)
                 .attr("class", "svg-default");

              svg.append("defs").append("clipPath")
                  .attr("id", "clip")
                  .append("rect")
                  .attr("width", props.linePlotWidth)
                  .attr("height", props.linePlotHeight);

              var plot = svg.append("g").attr("transform", "translate(" + props.padL + "," + props.padT + ")");

              plot.append("g").attr("class", "axis").attr("id", "y-axis");

              plot.append("path").attr("class", "line-plot-path").attr("id", "y-axis-path");
              plot.append("path").attr("class", "line-plot-path").attr("id", "mean-path");
              plot.append("path").attr("class", "mouse-position-path");
            }

            XDomain = XDomain.length ? XDomain : [0, rideData[N-1].sec];
            XScale.domain(XDomain);
            YScale.domain( props.YAxisRanges[field] );

            mean = calcMeanOverDomain(rideData, field, XDomain);
              
            meanLineData = [ { "x": XScale.range()[0], "y": YScale(mean) },
                             { "x": XScale.range()[1], "y": YScale(mean) } ];

            YAxis.tickValues(props.YAxisRanges[field].concat(mean));

            line.y(function(d) { return YScale(d[field]); });

            svg.select("#y-axis").call(YAxis);
            
            svg.select("#y-axis-path")
                .attr("d", function(d) { return line(rideData); })
                .attr("stroke", props.plotColors[field])
                .attr("stroke-width", 1)
                .attr("fill", "none");

            svg.select("#mean-path")
                .attr("d", function(d) { return meanLine(meanLineData); })
                .attr("stroke", props.plotColors[field])
                .style("stroke-dasharray", "3,3")
                .attr("stroke-width", 1)
                .attr("fill", "none");

            svg.on("mousemove", mousemove);


            function mousemove(d, i) {

              var mousePos  = d3.mouse(this);
              var divID     = d3.select(this.parentNode).attr("id");
              var mouseXPos = mousePos[0] - props.padL;

              dists = [];
              for (i = 0; i < rideData.length; i++) {
                dists.push( Math.abs(mouseXPos - XScale(rideData[i].sec)) );
              }

              mousePositionIndex = dists.indexOf(Math.min.apply(Math, dists));

              var mouseLine = d3.svg.line().x(function(d) { return d.x; }).y(function(d) { return d.y; }).interpolate("linear");
              
              var lineData = [ { "x": XScale(rideData[mousePositionIndex].sec), "y": YScale.range()[0] },
                               { "x": XScale(rideData[mousePositionIndex].sec), "y": YScale.range()[1] } ];

              d3.selectAll(".mouse-position-path").attr("d", mouseLine(lineData));

              // Draw trailing path on scatter plots
              // var XScale2D = d3.scale.linear().range( [0, props.linePlotWidth]).domain(props.YAxisRanges.hrt);
              // var YScale2D = d3.scale.linear().domain(props.YAxisRanges.pwr).range([props.linePlotHeight, 0]);

              // var trailingPath = d3.svg.line().x( function(d) {return XScale2D(d.hrt); })
              //                                 .y( function(d) {return YScale2D(d.pwr); }).interpolate("linear");

              // var trailingPathData = rideData.slice(mousePositionIndex < 10 ? mousePositionIndex : mousePositionIndex - 10, mousePositionIndex);
              
              // d3.select("#plot-2d").select("#trailing-mouse-path")
              //                      .attr("d", trailingPath(trailingPathData))
              //                      .style("stroke", function(d, i) {return d3.rgb(255*i/10, 255*i/10, 255*i/10);});

              mouseMarker.setLatLng([ +rideData[mousePositionIndex].lat, +rideData[mousePositionIndex].lon ]);
              mouseMarker.setRadius(  +rideData[mousePositionIndex].alt/100 );

              d3.selectAll(".line-plot-container")
                .select(".plot-title-value").text( function (d) { return rideData[mousePositionIndex][d.field()].toFixed(0); });

              d3.select("#alt-title").text(rideData[mousePositionIndex].alt.toFixed(0));

            } // mousemove

          } // linePlot

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
        } //makeLinePlot


        function makeScatterPlot() {

          props = definePlotProps();

          var field;

          var XScale = d3.scale.linear().range( [0, props.scatterPlot.width] );
          var YScale = d3.scale.linear().range( [props.scatterPlot.height, 0] );

          var color = d3.scale.linear().domain(props.YAxisRanges.spd).range(["steelblue", "red"]);

          var XAxis  = d3.svg.axis().scale(XScale).orient("bottom");
          var YAxis  = d3.svg.axis().scale(YScale).orient("left");

          function scatterPlot(div) {

            var svg = div.select("svg");
            var firstCall = 0;

            if (field[0].length==0) {return;}

            if (svg.empty()) { firstCall = 1; }

            if (firstCall) {
              svg = div.append("svg")
                  .attr("height", props.scatterPlot.height + props.scatterPlot.padB + props.scatterPlot.padB)
                  .attr("width",  props.scatterPlot.width + props.scatterPlot.padL + props.scatterPlot.padR)
                  .attr("class", "svg-default");

              var plot2D = svg.append("g").attr("transform", "translate(" + props.scatterPlot.padL + "," + props.scatterPlot.padT + ")");

              plot2D.append("g")
                  .attr("class", "axis")
                  .attr("id", "x-axis")
                  .attr("transform", "translate(0," + (props.scatterPlot.height) + ")");

              plot2D.append("g").attr("class", "axis").attr("id", "y-axis");

              plot2D.append("path").attr("id", "trailing-mouse-path")
                                   .style("fill", "none")
                                   .style("stroke", "#333")
                                   .style("stroke-width", "2");

            plot2D.append("text")
              .attr("class", "axis-label")
              .attr("id", "x-axis-label")
              .attr("text-anchor", "center")
              .attr("x", props.scatterPlot.width/2-15)
              .attr("y", props.scatterPlot.height + props.scatterPlot.padB)
              .text(props.units[field[0]]);

           plot2D.append("text")
              .attr("class", "axis-label")
              .attr("id", "y-axis-label")
              .attr("text-anchor", "center")
              .attr("x", -props.scatterPlot.height/2 - 15 )
              .attr("y",  -props.scatterPlot.padL )
              .attr("transform", "rotate(-90)")
              .text(props.units[field[1]]);
                
            } else {
              var plot2D = svg.select("g");
            }

            XScale.domain(props.YAxisRanges[field[0]]);
            YScale.domain(props.YAxisRanges[field[1]]);

            plot2D.select("#x-axis").call(XAxis);
            plot2D.select("#y-axis").call(YAxis);

            nSec = rideData[rideData.length-1].sec;

            plot2D.selectAll(".scatter-plot-dot")
                  .data(rideData)
                  .enter().append("circle")
                  .attr("class", "scatter-plot-dot")
                  .attr("r", 3)
                  .attr("cx", function(d){ return XScale(d[field[0]]); })
                  .attr("cy", function(d){ return YScale(d[field[1]]); })
                  .style("fill", function(d){ return color(d.spd); })
                  .style("fill-opacity", function(d) { 
                    var showPointFlag = 1;
                    if (d[field[0]] < props.YAxisRanges[field[0]][0]) { showPointFlag = 0;}
                    if (d[field[1]] < props.YAxisRanges[field[1]][0]) { showPointFlag = 0;}
                    return showPointFlag ? "0.3" : "0.0";
                   });

        } //scatterPlot   

        scatterPlot.field = function(val) {
          if (!arguments.length) return field;
            field = val;
            return scatterPlot;
        }


        return scatterPlot;

      } // makeScatterPlot

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
              pwr: [25, 420],
              hrt: [80, 185],
              cad: [40, 100],
              vam: [-4000, 2000],
              slp: [-10, 10],
            }

            var plotColors = {
              spd: "rgb(30, 190, 30)",
              pwr: "rgb(250, 80, 30)",
              hrt: "rgb(30, 80, 200)",
              cad: "rgb(220, 20, 190)",
              vam: "rgb(80, 80, 80)",
              slp: "rgb(30, 30, 30)",
            }

            var units = {
              spd: "mph",
              pwr: "watts",
              hrt: "bpm",
              cad: "rpm",
              vam: "VAM",
              slp: "slope",
            }

            var scatterPlotProps = {
              padL: 40,
              padR: 10,
              padT: 20,
              padB: 30,
              height: 200,
              width: 200,
            }

            var props = {
                padL: 35, padR: 5,
                padT: 5,  padB: 5,
                
                linePlotWidth:     500, 
                linePlotHeight:    50,
                xAxIsTimeFlag:     0,
                doSmoothingFlag:   0,

                YAxisRanges: YAxisRanges,
                plotColors:  plotColors,
                units:       units,
                scatterPlot: scatterPlotProps,
            }

            return props;
        }

