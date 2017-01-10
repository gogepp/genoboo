Meteor.methods({
	list: function(what){
		if (! this.userId) {
			throw new Meteor.Error('not-authorized');
		}
		if (! Roles.userIsInRole(this.userId,'curator')){
			throw new Meteor.Error('not-authorized');
		}
		let retval;
		switch( what ){
			case 'tracks':
				retval = Tracks.find({},{ fields: { _id: 0, trackName: 1 }}).fetch();
				break;
			case 'references':
				retval = References.find({},{ fields: { _id: 0, reference: 1 }}).fetch();
				break;
			default:
				throw new Meteor.Error('Can not list: ' + what) 
		}
		return retval;
	}
})