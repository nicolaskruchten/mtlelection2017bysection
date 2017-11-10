// Generated by CoffeeScript 1.12.5
(function() {
  var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  $(function() {
    var boroughFromDistrict, map, normalizePoste, padDigits, toPolygonId;
    L.TopoJSON = L.GeoJSON.extend({
      addData: function(jsonData) {
        var k, ref, results1, v;
        if (jsonData.type === "Topology") {
          ref = jsonData.objects;
          results1 = [];
          for (k in ref) {
            v = ref[k];
            results1.push(L.GeoJSON.prototype.addData.call(this, topojson.feature(jsonData, v)));
          }
          return results1;
        } else {
          return L.GeoJSON.prototype.addData.call(this, jsonData);
        }
      }
    });
    map = L.map('map', {
      attributionControl: false
    }).setView([45.56, -73.7], 11);
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
      attribution: '(c) <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (c) <a href="http://cartodb.com/attributions">CartoDB</a>, CartoDB <a href ="http://cartodb.com/attributions">attributions</a>',
      minZoom: 11,
      detectRetina: true,
      tap: true
    }).addTo(map);
    normalizePoste = function(p) {
      if (indexOf.call(p, ",") < 0) {
        p += ",00";
      }
      if (p.split(",")[1].length === 1) {
        p += "0";
      }
      return p;
    };
    padDigits = function(n, d) {
      return Array(Math.max(d - ("" + n).length + 1, 0)).join(0) + n;
    };
    toPolygonId = function(d, b) {
      return padDigits(d, 3) + "-" + padDigits(b, 3);
    };
    boroughFromDistrict = function(district_id) {
      return district_id.slice(0, -1);
    };
    return queue().defer(d3.json, "index.json").defer(d3.json, "sections.topojson").await(function(error, index, sections) {
      var processRow, results;
      results = {};
      processRow = function(r) {
        var base, base1, id, k, party, post, post_type, results1, v;
        post = index.posts[normalizePoste(r.Poste)];
        post_type = post.type;
        results1 = [];
        for (k in r) {
          v = r[k];
          if (!(isFinite(k) && isFinite(v) && +v > 0)) {
            continue;
          }
          id = toPolygonId(r.District, k);
          if (results[id] == null) {
            results[id] = {
              polygonId: id,
              section: k,
              district: "" + r.District,
              borough: boroughFromDistrict("" + r.District)
            };
          }
          if ((base = results[id])[post_type] == null) {
            base[post_type] = {
              winner: {
                name: "",
                votes: 0
              },
              totalVotes: 0,
              results: {},
              results_by_party: {}
            };
          }
          results[id][post_type].results[r.Candidat] = +v;
          if (+v > results[id][post_type].winner.votes) {
            results[id][post_type].winner.name = r.Candidat;
            results[id][post_type].winner.votes = +v;
          }
          party = index.candidates[r.Candidat];
          if ((base1 = results[id][post_type].results_by_party)[party] == null) {
            base1[party] = 0;
          }
          results[id][post_type].results_by_party[party] += +v;
          results1.push(results[id][post_type].totalVotes += +v);
        }
        return results1;
      };
      return queue().defer(d3.csv, "data.csv", processRow).await(function() {
        var borough, colorForCandidate, id, inputGeo, inputParams, inputParty, inputPost, layer, name, optGroup, ref, select, showResults, updateMap;
        colorForCandidate = function(winner) {
          return index.parties["" + index.candidates[winner]].color;
        };
        showResults = function(sectionResult, postIn) {
          var arc, candidate, dim, g, i, k, len, pie, pieData, r, ref, ref1, sorted, svg, table, v, votes;
          r = sectionResult[postIn];
          $("#result").append($("<p align='center'>")).css({
            "margin-top": "5px"
          }).text(index.districts[sectionResult.district] + " #" + sectionResult.polygonId);
          pieData = [];
          ref = r.results;
          for (candidate in ref) {
            votes = ref[candidate];
            pieData.push({
              candidate: candidate,
              votes: votes,
              color: colorForCandidate(candidate)
            });
          }
          dim = 150;
          arc = d3.svg.arc().outerRadius(dim / 2 - 10).innerRadius(0);
          pie = d3.layout.pie().value(function(d) {
            return d.votes;
          });
          svg = d3.select($("#result").get(0)).append("svg").attr("width", 250).attr("height", dim).append("g").attr("transform", "translate(" + 125 + "," + dim / 2 + ")");
          g = svg.selectAll(".arc").data(pie(pieData)).enter().append("g").attr("class", "arc");
          g.append("path").attr("d", arc).style("fill", function(d) {
            return d.data.color;
          }).style("stroke", "white").style("weight", 1);
          table = $("<table cellpadding='5' width='100%'>").append($("<tr>").append($("<th colspan='2'>").text("Candidat"), $("<th>").css({
            width: "20px"
          }).text("Votes")));
          sorted = ((function() {
            var ref1, results1;
            ref1 = r.results;
            results1 = [];
            for (k in ref1) {
              v = ref1[k];
              results1.push([k, v]);
            }
            return results1;
          })()).sort(function(a, b) {
            return b[1] - a[1];
          });
          for (i = 0, len = sorted.length; i < len; i++) {
            ref1 = sorted[i], candidate = ref1[0], votes = ref1[1];
            table.append($("<tr>").append($("<td>").css({
              width: "15px",
              background: colorForCandidate(candidate)
            }), $("<td>").text(candidate), $("<td align='right'>").html(votes + "&nbsp;")));
          }
          return $("#result").append(table);
        };
        layer = null;
        updateMap = function() {
          var geoIn, numPolygons, partyColor, partyIn, partyScale, postIn;
          $("#result").html("");
          partyIn = $("#party").val();
          postIn = $("#post").val();
          geoIn = $("#geo").val();
          if (window.ga != null) {
            ga('send', 'pageview', '/' + partyIn + "~" + postIn + "~" + geoIn);
          }
          if (history.replaceState) {
            history.replaceState(null, null, '#' + partyIn + "~" + postIn + "~" + geoIn);
          }
          switch (partyIn) {
            case "0":
              break;
            default:
              partyColor = index.parties[partyIn].color;
              partyScale = d3.scale.linear().domain([0, 100]).range(["white", partyColor]).clamp(true);
          }
          numPolygons = 0;
          if (layer != null) {
            map.removeLayer(layer);
          }
          layer = new L.TopoJSON(sections, {
            style: function(d) {
              var c, r, ref, style;
              r = results[d.properties.id][postIn];
              switch (partyIn) {
                case "0":
                  c = colorForCandidate(r.winner.name);
                  break;
                default:
                  c = partyScale((ref = r.results_by_party[partyIn]) != null ? ref : 0);
              }
              style = {
                fillColor: c,
                color: c,
                weight: 1,
                fillOpacity: 0.6
              };
              numPolygons += 1;
              return style;
            },
            filter: function(d) {
              var geoId, geoType, ref;
              if (!(d.properties.id in results)) {
                return false;
              }
              if (!(postIn in results[d.properties.id])) {
                return false;
              }
              if (results[d.properties.id][postIn].results == null) {
                return false;
              }
              ref = geoIn.split("-"), geoType = ref[0], geoId = ref[1];
              if (geoType === "M") {
                return true;
              }
              if (geoType === "A") {
                return geoId === results[d.properties.id].borough;
              }
              if (geoType === "D") {
                return geoId === results[d.properties.id].district;
              }
            },
            onEachFeature: function(f, l) {
              return l.on({
                dblclick: function(e) {
                  return map.setView(e.latLng, map.getZoom() + 1);
                },
                mouseout: function(e) {
                  layer.resetStyle(e.target);
                  return $("#result").html("");
                },
                mouseover: function(e) {
                  e.target.setStyle({
                    weight: 4,
                    color: '#fff',
                    opacity: 1,
                    fillOpacity: 0.9
                  });
                  if (!L.Browser.ie && !L.Browser.opera) {
                    e.target.bringToFront();
                  }
                  return showResults(results[e.target.feature.properties.id], postIn);
                },
                click: function(e) {
                  var last_target;
                  last_target = $("#result").data('last_target');
                  if (last_target != null) {
                    layer.resetStyle(last_target);
                  }
                  $("#result").data('last_target', e.target);
                  e.target.setStyle({
                    weight: 4,
                    color: '#fff',
                    opacity: 1,
                    fillOpacity: 0.9
                  });
                  if (!L.Browser.ie && !L.Browser.opera) {
                    e.target.bringToFront();
                  }
                  return showResults(results[e.target.feature.properties.id], postIn);
                }
              });
            }
          });
          if (numPolygons > 0) {
            if (window.initialFit == null) {
              map.fitBounds(layer.getBounds());
              window.initialFit = 'done';
            }
            return map.addLayer(layer);
          }
        };
        select = $("<select>", {
          id: "geo"
        }).css({
          width: "240px"
        });
        select.append($("<option>"));
        optGroup = $("<optgroup>").attr("label", "Montréal");
        optGroup.append($("<option>").val("M-0").text("Tout Montréal"));
        select.append(optGroup);
        ref = index.districts;
        for (id in ref) {
          name = ref[id];
          if (!(id !== "0")) {
            continue;
          }
          if (boroughFromDistrict(id) !== borough) {
            borough = boroughFromDistrict(id);
            optGroup = $("<optgroup>").attr("label", index.boroughs[borough]);
            optGroup.append($("<option>").val("A-" + borough).text("Tout " + index.boroughs[borough] + " (" + borough + ")"));
            select.append(optGroup);
          }
          optGroup.append($("<option>").val("D-" + id).text(name + " (" + id + ")"));
        }
        select;
        $("#sidebar").append(select).append($("<div id='result'>"));
        inputParams = window.location.hash.slice(1).split("~");
        if (inputParams.length !== 3) {
          inputParams = ["0", "MV", "M-0"];
        }
        inputParty = inputParams[0], inputPost = inputParams[1], inputGeo = inputParams[2];
        $("#party").val(inputParty).css({
          width: "240px"
        }).chosen({
          disable_search: true
        }).bind("change", updateMap);
        $("#post").val(inputPost).css({
          width: "240px"
        }).bind("change", updateMap).chosen({
          disable_search: true
        });
        select.val(inputGeo).bind("change", updateMap).chosen({
          search_contains: true,
          placeholder_text_single: "Choissez un poste..."
        });
        return updateMap();
      });
    });
  });

}).call(this);