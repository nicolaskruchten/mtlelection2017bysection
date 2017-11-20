$ ->
  L.TopoJSON = L.GeoJSON.extend
    addData: (jsonData) ->
      if (jsonData.type == "Topology")
        for k, v of jsonData.objects
          L.GeoJSON.prototype.addData.call(this, topojson.feature(jsonData, v))
      else
        L.GeoJSON.prototype.addData.call(this, jsonData)

  map = L.map('map', attributionControl: false).setView([45.56, -73.7], 11)
  L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
    attribution: '(c) <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (c) <a href="http://cartodb.com/attributions">CartoDB</a>, CartoDB <a href ="http://cartodb.com/attributions">attributions</a>',
    minZoom: 11, detectRetina: true, tap: true
  }).addTo(map)


  normalizePoste = (p) ->
    p += ",00" if "," not in p
    p += "0" if p.split(",")[1].length == 1
    return p

  padDigits = (n, d) -> Array(Math.max(d - "#{n}".length + 1, 0)).join(0) + n

  toPolygonId = (d, b) -> padDigits(d,3)+"-"+padDigits(b,3)

  boroughFromDistrict = (district_id) -> district_id.slice(0,-1)


  queue()
    .defer(d3.json, "index.json")
    .defer(d3.json, "sections.topojson")
    .await (error, index, sections) ->

      results = {}
      processRow = (r) ->
        post = index.posts[normalizePoste(r.Poste)]
        post_type = post.type
        for k,v of r when isFinite(k) and isFinite(v) and +v > 0
          id = toPolygonId r.District, k
          results[id] ?=
            polygonId: id
            section: k
            district: ""+r.District
            borough: boroughFromDistrict(""+r.District)

          results[id][post_type] ?=
            winner: {name: "", votes: 0}
            totalVotes: 0
            results: {}
            results_by_party: {}

          results[id][post_type].results[r.Candidat] = +v
          if +v > results[id][post_type].winner.votes
            results[id][post_type].winner.name = r.Candidat
            results[id][post_type].winner.votes = +v

          party = index.candidates[r.Candidat]
          results[id][post_type].results_by_party[party] ?= 0
          results[id][post_type].results_by_party[party] += +v
          results[id][post_type].totalVotes += +v


      queue()
      .defer(d3.csv, "data.csv", processRow)
      .await ->
        #console.log results
        colorForCandidate = (winner) ->
          index.parties[""+index.candidates[winner]].color

        showResults = (sectionResult, postIn) ->
          r = sectionResult[postIn]
          $("#result").append $("<p align='center'>")
            .css("margin-top": "5px")
            .text(index.districts[sectionResult.district]+" #"+sectionResult.polygonId)

          pieData = []
          for candidate, votes of r.results
            pieData.push
              candidate: candidate
              votes: votes
              color: colorForCandidate candidate

          dim = 150

          arc = d3.svg.arc()
            .outerRadius(dim/2 - 10)
            .innerRadius(0)

          pie = d3.layout.pie().value((d) -> d.votes)

          svg = d3.select($("#result").get(0)).append("svg")
            .attr("width", 250)
            .attr("height", dim)
            .append("g")
            .attr("transform", "translate(" + 125 + "," + dim / 2 + ")")


          g = svg.selectAll(".arc")
            .data(pie(pieData))
            .enter().append("g")
            .attr("class", "arc")

          g.append("path")
            .attr("d", arc)
            .style("fill", (d) -> d.data.color )
            .style("stroke", "white" )
            .style("weight", 1 )

          table = $("<table cellpadding='5' width='100%'>").append(
            $("<tr>").append(
              $("<th colspan='2'>").text("Candidat"),
              $("<th>").css(width: "20px").text("Votes"),
              )
            )
          sorted = ([k, v] for k, v of r.results).sort (a,b) -> b[1] - a[1]
          for [candidate, votes] in sorted
            table.append $("<tr>").append(
              $("<td>").css(
                width: "15px",
                background: colorForCandidate(candidate)
                ),
              $("<td>").text(candidate),
              $("<td align='right'>").html(votes+"&nbsp;"),
              )
          $("#result").append(table)

        layer = null
        updateMap = ->
          $("#result").html("")
          partyIn = $("#party").val()
          postIn = $("#post").val()
          geoIn = $("#geo").val()

          #if window.ga?
          #  ga('send', 'pageview', '/'+partyIn+"~"+postIn+"~"+geoIn)

          if history.replaceState
            history.replaceState(null, null, '#'+partyIn+"~"+postIn+"~"+geoIn)

          switch partyIn
            when "0" then #special-case below
            else
              partyColor = index.parties[partyIn].color
              partyScale = d3.scale.linear().domain([0,100])
                .range(["white", partyColor]).clamp(true)

          numPolygons = 0
          map.removeLayer(layer) if layer?
          layer = new L.TopoJSON sections,
            style: (d) ->
              r = results[d.properties.id][postIn]
              switch partyIn
                when "0"
                  c= colorForCandidate(r.winner.name)
                else
                  c = partyScale(r.results_by_party[partyIn] ? 0)
              style =
                fillColor: c
                color: c
                weight: 1
                fillOpacity: 0.6
              numPolygons+=1
              return style
            filter: (d) ->
              return false unless d.properties.id of results
              return false unless postIn of results[d.properties.id]
              return false unless results[d.properties.id][postIn].results?
              [geoType, geoId] = geoIn.split("-")
              if geoType == "M"
                return true
              if geoType == "A"
                return geoId == results[d.properties.id].borough
              if geoType == "D"
                return geoId == results[d.properties.id].district
            onEachFeature: (f, l) ->
              l.on
                dblclick: (e) ->
                  map.setView(e.latLng, map.getZoom()+1)
                mouseout: (e) ->
                  layer.resetStyle(e.target)
                  $("#result").html("")
                mouseover: (e) ->
                  e.target.setStyle
                    weight: 4
                    color: '#fff'
                    opacity: 1
                    fillOpacity: 0.9

                  if (!L.Browser.ie && !L.Browser.opera)
                    e.target.bringToFront()

                  showResults(results[e.target.feature.properties.id], postIn)
                click: (e) ->
                  last_target = $("#result").data('last_target')
                  layer.resetStyle(last_target) if last_target?
                  $("#result").data('last_target', e.target)
                  e.target.setStyle
                    weight: 4
                    color: '#fff'
                    opacity: 1
                    fillOpacity: 0.9

                  if (!L.Browser.ie && !L.Browser.opera)
                    e.target.bringToFront()
                  showResults(results[e.target.feature.properties.id], postIn)
          if numPolygons > 0
            unless window.initialFit?
              map.fitBounds(layer.getBounds())
              window.initialFit = 'done'
            map.addLayer(layer)


        select = $("<select>", id: "geo").css(width: "240px")
        select.append $("<option>")
        optGroup = $("<optgroup>").attr "label", "Montréal"
        optGroup.append $("<option>").val("M-0").text("Tout Montréal")
        select.append optGroup

        for id, name of index.districts when id != "0"
          if boroughFromDistrict(id) != borough
            borough = boroughFromDistrict(id)
            optGroup = $("<optgroup>").attr "label", index.boroughs[borough]
            optGroup.append $("<option>").val("A-"+borough).text("Tout " + index.boroughs[borough] + " ("+borough+")")
            select.append optGroup
          optGroup.append $("<option>").val("D-"+id).text(name + " ("+id+")")

        select
        $("#sidebar").append(select).append($("<div id='result'>"))

        inputParams = window.location.hash.slice(1).split("~");
        inputParams = ["0", "MV", "M-0"] if inputParams.length != 3
        [inputParty, inputPost, inputGeo] = inputParams


        $("#party").val(inputParty)
          .css(width: "240px")
          .chosen(disable_search: true)
          .bind("change", updateMap)

        $("#post").val(inputPost)
          .css(width: "240px")
          .bind("change", updateMap)
          .chosen(disable_search: true)

        select.val(inputGeo)
          .bind("change", updateMap)
          .chosen(search_contains: true, placeholder_text_single: "Choissez un poste...")


        updateMap()


