var CountTo = React.createClass({
	getInitialState: function() {
		var { mountval=0 } = this.props;
		return {
			val: mountval
		}
	},
	componentDidMount: function() {
		this.timeouts = [];
		this.transition();
	},
	componentWillUnmount: function() {
		this.stopall();
	},
	componentDidUpdate: function(prevProps) {
		if (this.props.end !== prevProps.end) {
			this.stopall();
			this.transition();
		}
	},
	stopall: function() {
		if (this.timeouts) {
			for (var timeout of this.timeouts) {
				clearTimeout(timeout);
			}
		}
		this.timeouts = [];
	},
	transition: function() {
		var { transition, duration, end } = this.props;
		var { val } = this.state;
		if (val !== end) {
			var steps = countToCalcSteps(duration, val, end, transition);
			steps.forEach(function(step) {
				this.timeouts.push( setTimeout(()=>this.setState({val:step.val}), step.time) );
			}.bind(this));
		}
	},
	render: function() {
		var { val } = this.state;
		return React.createElement('span', undefined,
			val
		);
	}
});

function B1(t) { return t*t*t }
function B2(t) { return 3*t*t*(1-t) }
function B3(t) { return 3*t*(1-t)*(1-t) }
function B4(t) { return (1-t)*(1-t)*(1-t) }

function getBezier(percent,x2,y2,x3,y3) {
  var pos = {x:0, y:0};
  pos.x = 0*B1(percent) + x2*B2(percent) + x3*B3(percent) + 1*B4(percent);
  pos.y = 0*B1(percent) + y2*B2(percent) + y3*B3(percent) + 1*B4(percent);
  return pos;
}

function countToCalcSteps(duration, start, end, bezier='ease-in-out') {
	// duration is in milliseconds
	// start is an integer
	// end is an integer
	// bezier is an array of 4 - OR special string - linear, ease, ease-in, ease-out, ease-in-out

	// returns
	/*
		{
			time: [0, ..., duration]
			val: [start, ..., end]
		}
	*/
	// step is determined on if the cur is a whole number

	if (!Array.isArray(bezier)) {
		var special_bezier = {
			'ease': [.25,.1,.25,1],
			'linear': [0,0,1,1],
			'ease-in': [.42,0,1,1],
			'ease-out': [0,0,.58,1],
			'ease-in-out': [.42,0,.58,1]
		};
		bezier = special_bezier[bezier];
	}

	var steps = [];

	for (var i=0; i<101; i++) {
		var scale = getBezier((100-i)/100, ...bezier);
		var cur_val = Math.round((scale.y * (end - start)) + start);

		if (!steps.length || steps[steps.length-1].val !== cur_val) {
			var cur_time = Math.round(scale.x * duration);
			steps.push({time:cur_time,val:cur_val});
		}
	}

	return steps;
}
