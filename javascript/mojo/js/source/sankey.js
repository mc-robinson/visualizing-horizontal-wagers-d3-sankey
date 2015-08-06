//Author: Ming Qin at Yahoo! Inc.
//Forked from Mike Bostock's [D3 Sankey plugin](https://github.com/d3/d3-plugins/tree/master/sankey)

d3.sankey = function() {
  var sankey = {},
      nodeWidth = 24,
      nodePadding = 8,
      size = [1, 1],
      nodes = [],
      flows = [],
      links = [],
      dlinks = [], //dynamic links
      linkDict = {},
      ky = 0;

  sankey.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankey;
  };

  sankey.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankey;
  };

  sankey.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return sankey;
  };

  sankey.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankey;
  };

  sankey.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankey;
  };

  sankey.layout = function(iterations) {
    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    computeLinkDepths();
    return sankey;
  };

  sankey.relayout = function() {
    computeLinkDepths();
    computeDlinks();
    // console.log(links[0].dy,links[0].sy,links[0].ty);
    return sankey;
  };

  sankey.link = function() {
    var curvature = 0.5;

    function link(d) {
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          xi = d3.interpolateNumber(x0, x1),
          x2 = xi(curvature),
          x3 = xi(1 - curvature),
          y0 = d.source.y + d.sy + d.dy / 2,
          y1 = d.target.y + d.ty + d.dy / 2;
      return "M" + x0 + "," + y0 +
             "C" + x2 + "," + y0 +
             " " + x3 + "," + y1 +
             " " + x1 + "," + y1;
    }

    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  };

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      // if (typeof source === "number") source = link.source = nodes[link.source];
      // if (typeof target === "number") target = link.target = nodes[link.target];
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    nodes.forEach(function(node) {
      node.value = Math.max(
        d3.sum(node.sourceLinks, value),
        d3.sum(node.targetLinks, value)
      );
    });
  }

  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.
  function computeNodeBreadths() {
      var remainingNodes = nodes,
          nextNodes,
          x = 0;

      function pick_node(node) {
          node.x = x;
          node.dx = nodeWidth;
          node.sourceLinks.forEach(push_if_didnt);
      }

      function push_if_didnt(link) {
          if (nextNodes.indexOf(link.target) < 0) {
              nextNodes.push(link.target);
          }
      }

      while (remainingNodes.length) {
          nextNodes = [];
          remainingNodes.forEach(pick_node);
          remainingNodes = nextNodes;
          ++x;
      }

      //
      moveSinksRight(x);
      scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
  }

  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }

  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }

  function computeNodeDepths(iterations) {
    var nodesByBreadth = d3.nest()
        .key(function(d) { return d.x; })
        .sortKeys(d3.ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });

    //
    initializeNodeDepth();
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= 0.99);
      resolveCollisions();
      relaxLeftToRight(alpha);
      resolveCollisions();
    }

    function initializeNodeDepth() {
      ky = d3.min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
      });

      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          node.y = i;
          node.dy = node.value * ky;
        });
      });

      links.forEach(function(link) {
        link.dy = link.value * ky;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }
  }

  function ascendingDepth(a, b) {
    return a.y - b.y;
  }

  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty;
        ty += link.dy;
      });
    });
  }

  function ascendingSourceDepth(a, b) {
    return a.source.y - b.source.y;
  }

  function ascendingTargetDepth(a, b) {
    return a.target.y - b.target.y;
  }

  function center(node) {
    return node.y + node.dy / 2;
  }

  function value(link) {
    return link.value;
  }

  //////////////////////////////
  // Ming : for the dynamic links
  ////////////////////////////

  //will modify linkDict, links, flows
  sankey.flows = function(_) {
    flows = _;
    if (!nodes.length) console.error('sankey.nodes() must be called before flows()');
    linkDict = {};

    flows.forEach(function (f, ind) {

      //build index in nodes
      f.thru.forEach(function (n){
        n = normalizeNode(n);
        if (!n.flows){
          n.flows = {};
        }
        n.flows[ind] = true;
      });

      //extract links
      for (var i = 0; i < f.thru.length - 1; i++) {
        var key = stPair(f.thru[i], f.thru[i + 1]);
        if (linkDict[key]) {
          linkDict[key].value += f.value;
          linkDict[key].flows.push(f);
        } else {
          linkDict[key] = {
            source: f.thru[i],
            target: f.thru[i + 1],
            value: f.value,
            flows: [f],
          };
        }

      }
    });
    nodes.forEach(function (n){
      var sets = n.flows;
      n.flows = [];
      for (var i in sets){
        n.flows.push(flows[i]);
      }
    });

    links = [];
    for (var key in linkDict) {
      var l = linkDict[key];
      l.source = normalizeNode(l.source);
      l.target = normalizeNode(l.target);
      links.push(l);
    }

    return sankey;
  };

  //will modify dlinks
  sankey.dflows = function(dflows) {
    var dict = {};
    dflows.forEach(function (f) {
      for (var i = 0; i < f.thru.length - 1; i++) {
        var key = stPair(f.thru[i], f.thru[i + 1]);
        if (dict[key]) {
          dict[key].value += f.value;
        } else {
          dict[key] = {
            source: f.thru[i],
            target: f.thru[i + 1],
            value: f.value,
            sy: linkDict[key].sy,
            ty: linkDict[key].ty,
          };
        }
      }
    });
    dlinks = [];
    for (var key in dict) {
      var l = dict[key];
      l.source = normalizeNode(l.source);
      l.target = normalizeNode(l.target);
      l.dy = l.value * ky;
      dlinks.push(dict[key]);
    }
    // debugger;
    this.relayout();
    return sankey;
  };

  sankey.dlinks = function() {
    return dlinks;
  };

  function stPair(s, t) {
    if (typeof s === 'number') {
      return nodes[s].name + '|' + nodes[t].name ;
    } else if (typeof s === 'object') {
      return s.name + '|' + t.name;
    } else if (typeof s === 'string'){
      return s + '|' + t;
    } else {
      console.error('wrong type');
    }
  }

  function normalizeNode(n) {
    if (typeof n === "number"){
      return nodes[n];
    } else if (typeof n === "object"){
      return n;
    } else{
      console.error('not implemented');
      return null;
    }
  }

  function computeDlinks() {
    dlinks.forEach(function (l) {
      var slink = linkDict[stPair(l.source, l.target)];
      l.sy = slink.sy;
      l.ty = slink.ty;
    });
  }

  return sankey;
};
