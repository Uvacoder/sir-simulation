import { County, SirSimulation } from './simulation.js';

      const simulation = new SirSimulation();

      var width = 960,
          height = 600;

      /* d3 selectors with active elements when a state is selected */
      var active_state = d3.select(null),
          active_counties = d3.select(null);

      /* standard US projection */
      var projection = d3.geo.albersUsa()
          .scale(1280)
          .translate([width / 2, height / 2]);

      /* path used to draw all geometric elements */
      var path = d3.geo.path()
          .projection(projection);

      /* create a new svg element */
      var svg = d3.select("#vis").append("svg")
          .attr("width", width)
          .attr("height", height);

      /* chrome cannot handle svg transforms, so svg is really a nested g tag */
      svg = svg.append("g");

      /* map for converting county id (fips) to population */
      var popById = d3.map();

      /* array of commutes */
      var commutes = [],
          active_commutes = [];

      /* wait for files to load and update popById */
      queue()
          .defer(d3.json, "data/us.json")
          .defer(d3.tsv, "data/commuter.tsv")
          .defer(d3.tsv, "data/population.tsv", function (d) { popById.set(d.id, +d.population); })
          .await(ready);

      function ready(error, us, commuter_data, onchage) {
        if (error) throw error;

        commutes = commuter_data;

        /* draw all counties */
        svg.append("g")
          .attr("class", "counties")
          .selectAll("path")
            .data(topojson.feature(us, us.objects.counties).features)
          .enter().append("path")
            .attr("d", path)
            .attr("class", "county")
            .attr("id", function (d) { return "s" + d.id; })
            .on("mouseover", function () {
              this.parentNode.appendChild(this);
              d3.select(this)
                .classed("hovered", true);
            })
            .on("mouseout", function () {
              d3.select(this)
                .classed("hovered", false);
            })
            .on("click", county_clicked);

        /* draw all states */
        svg.append("g")
          .attr("class", "states")
          .selectAll("path")
            .data(topojson.feature(us, us.objects.states).features)
          .enter().append("path")
            .attr("d", path)
            .attr("class", "state")
            .on("click", state_clicked);
      }

      function state_clicked(d) {
        if (active_state.node() != null && active_state.node() != this) return reset();

        /* remove old active states and counties */
        active_state.classed("active", false);
        active_counties.classed("active", false);

        /* make the clicked state active */
        active_state = d3.select(this).classed("active", true);

        /* make the state's counties active */
        var state_id = d.id;
        active_counties = svg.select("g.counties")
                            .selectAll("path.county")
                              .classed("active", function (d) { return Math.floor(d.id/1000) == state_id && popById.get(d.id) !== undefined; });
        active_counties = active_counties.filter(".active");

        /* get all relevant commutes */
        active_commutes = commutes.filter(function (d) {
          var id = +d.home_id;
          return Math.floor(id / 1000) == state_id && popById.get(id) !== undefined;
        });

        /* initialize the simulation */
        var counties = [];
        active_counties.each(function (d, i) {
          counties.push(new County(simulation, i, d.id, popById.get(d.id), active_commutes.filter(function (c) { return +c.home_id == d.id; })));
        });
        var r_nought = document.getElementById("reproduction").value;
        var D = document.getElementById("duration").value;
        var vacc = document.getElementById("vacc").value / 100;
        simulation.init(counties, r_nought*(1/D), 1/D, vacc, onchange);

        /* get bounds of state */
        var bounds = path.bounds(d),
            dx = bounds[1][0] - bounds[0][0],
            dy = bounds[1][1] - bounds[0][1],
            x = (bounds[0][0] + bounds[1][0]) / 2,
            y = (bounds[0][1] + bounds[1][1]) / 2,
            scale = .9 / Math.max(dx / width, dy / height),
            translate = [width / 2 - scale * x, height / 2 - scale * y];

        /* transition svg to fit bounds of state */
        svg.transition()
            .duration(750)
            .style("stroke-width", 1.5 / scale + "px")
            .attr("transform", "translate(" + translate + ")scale(" + scale + ")");
      }

      function county_clicked(d) {
        if (!simulation.running) {
          var n = Math.floor(document.getElementById("infected").value);
          simulation.start(d.id, n);
        }
      }

      function reset() {
        simulation.reset();

        active_state.classed("active", false);
        active_state = d3.select(null);

        active_counties.classed("active", false);
        active_counties = d3.select(null);

        svg.transition()
            .duration(750)
            .style("stroke-width", "1.5px")
            .attr("transform", "");
      }

      function onchange(c_inf, t_inf, day) {
        document.getElementById("sim_day").innerHTML = Math.floor(day).toLocaleString();
        document.getElementById("c_inf").innerHTML = Math.round(c_inf).toLocaleString();
        document.getElementById("t_inf").innerHTML = Math.round(t_inf).toLocaleString();
      }

      d3.select(self.frameElement).style("height", height + "px");