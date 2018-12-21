function appViewModel() {
  var self = this;
  var map, city, infowindow;

  this.meetups = ko.observableArray([]); //initial list of meetups
  this.filteredList = ko.observableArray([]); //list filtered by search keyword
  this.mapMarkers = ko.observableArray([]); //holds all map markers
  this.meetupStatus = ko.observable('Searching meetups nearby...');
  this.numMeetups = ko.computed(function() {
    return self.filteredList().length; //number of meetup found
  });

  //Hold the current location's lat & lng
  this.currentLat = ko.observable(52.520008);
  this.currentLng = ko.observable(13.404954);

  // Initialize Google map, perform initial meetup search in berlin.
  function mapInitialize() {
    city = new google.maps.LatLng(52.520008, 13.404954);
    map = new google.maps.Map(document.getElementById('map'), {
      center: city,
      zoom: 12,
      zoomControlOptions: {
        position: google.maps.ControlPosition.LEFT_CENTER,
        style: google.maps.ZoomControlStyle.SMALL
      },
      mapTypeControl: false,
      panControl: false
    });
    clearTimeout(self.mapRequestTimeout);

    google.maps.event.addDomListener(window, "resize", function() {
      var center = map.getCenter();
      google.maps.event.trigger(map, "resize");
      map.setCenter(center);
    });

    infowindow = new google.maps.InfoWindow({
      maxWidth: 300
    });
    getMeetups('berlin');
  }

  //Error handling if Google Maps fails to load
  this.mapRequestTimeout = setTimeout(function() {
    $('#map').html("An Error occurred While loading Google Maps." +
      " Please refresh your browser and try again.");
  }, 8000);

  //Re-center map if you're viewing meetups that are further away
  this.centerMap = function() {
    infowindow.close();
    var cityCenter = new google.maps.LatLng(self.currentLat(), self.currentLng());
    map.panTo(cityCenter);
    map.setZoom(12);

  };

  // Use API to get meetups data and store the info as objects in an array
  function getMeetups(location) {
    //get current date and time for the reauest setup
    var today = new Date(),
      currentDate = today.toISOString().split('T')[0],
      currentTime = today.toLocaleTimeString("de"),
      //YYYY-MM-DDTHH:MM:SS
      //for testing
      //currentTime="07:00:00",
      startDateTime = currentDate + "T" + currentTime,
      endDateTime = currentDate + "T23:59:55";
    //for testing
    // endDateTime = "2018-12-22T23:59:00";
    //Meetup documentation
    //https://www.meetup.com/meetup_api/docs/find/upcoming_events/
    //set the request url
    var meetupUrl = "https://api.meetup.com/find/upcoming_events/" +
      "?key=1d4d326536511d1f4d2a297b7a6c6e&lat=" + self.currentLat() +
      "&lon=" + self.currentLng() + "&start_time_range=" + currentTime +
      "&end_time_range=23:59:55" + "&start_date_range=" + startDateTime +
      "&end_date_range=" + endDateTime + "&radius=smart";

    $.ajax({
      url: meetupUrl,
      dataType: 'jsonp',
      success: function(data) {
        //  console.log(data);
        //get the length of the meetups array and the meetup array
        var len = data.data.events.length;
        var events = data.data.events;

        //loop through the array and get the needed infos
        for (var i = 0; i < len; i++) {
          if (events[i].venue === undefined) continue;
          var eventName = events[i].name,
            eventTime = events[i].local_time,
            eventLink = events[i].link,
            venueLat = events[i].venue.lat,
            venueLon = events[i].venue.lon,
            venueName = events[i].venue.name,
            venueAdr = events[i].venue.address_1;

          //push results into the meetups array
          self.meetups.push({
            mName: eventName,
            mTime: eventTime,
            mLink: eventLink,
            vLat: venueLat,
            vLon: venueLon,
            vName: venueName,
            vAdr: venueAdr
          });

        }
        //add it to the filteredList
        self.filteredList(self.meetups());
        //call the mapMarkers function to handle the markers
        mapMarkers(self.meetups());
        //set the status to empyty
        self.meetupStatus(self.numMeetups() + ' meetup found nearby.');
      },
      error: function() {
        self.meetupStatus('Something went wrong, please refresh');
      }
    });
  }

  // Create bounce effect for markers
  function bounce(marker) {
    marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(function() {
      marker.setAnimation(null);
    }, 2100);
  };

  // Create and place markers and info windows on the map based on data from API
  function mapMarkers(array) {
    $.each(array, function(index, value) {
      var latitude = value.vLat,
        longitude = value.vLon,
        geoLoc = new google.maps.LatLng(latitude, longitude),
        meetup = value.mName;

      var contentString = '<div id="infowindow" class="text-center">' +
        '<h3 class="card-title">' + value.mName + '</h3>' +
        '<p class="card-text"><i class="fas fa-clock"></i> ' + value.mTime + '</p>' +
        '<p class="card-text"><i class="fas fa-map-marker"></i> ' + value.vName + ", " + value.vAdr + '</p>' +
        '<a class="btn btn-primary" href="' + value.mLink + '" target="_blank">View meetup</a>' +
        '</div>';

      var marker = new google.maps.Marker({
        position: geoLoc,
        title: meetup,
        map: map
      });
      self.mapMarkers.push({
        marker: marker,
        content: contentString
      });

      //generate infowindows for each meetup and the
      //click event for the marker
      google.maps.event.addListener(marker, 'click', function() {
        bounce(marker);
        infowindow.setContent(contentString);
        map.setZoom(14);
        map.setCenter(marker.position);
        infowindow.open(map, marker);
        map.panBy(0, -150);

      });
    });
  }

  // When a meetup on the list is clicked, go to corresponding marker and open its info window.
  this.goToMarker = function(clickedMeetup) {
    var clickedMeetupName = clickedMeetup.mName;
    for (var key in self.mapMarkers()) {
      if (clickedMeetupName === self.mapMarkers()[key].marker.title) {
        map.panTo(self.mapMarkers()[key].marker.position);
        map.setZoom(14);
        bounce(self.mapMarkers()[key].marker);
        infowindow.setContent(self.mapMarkers()[key].content);
        infowindow.open(map, self.mapMarkers()[key].marker);
        map.panBy(0, -150);
      }
    }
  };

  this.filterKeyword = ko.observable('');

  //Clear keyword from filter and show all meetups again.
  this.clearFilter = function() {
    self.filteredList(self.meetups());
    self.filterKeyword('');
    for (var i = 0; i < self.mapMarkers().length; i++) {
      self.mapMarkers()[i].marker.setMap(map);
    }
    self.meetupStatus(self.numMeetups() + ' meetup found nearby.');
  };




  //Compare search keyword against meetup names.  Return a filtered list and map markers of request.
  this.filterResults = function() {
    var searchWord = self.filterKeyword().toLowerCase();
    var array = self.meetups();
    if (!searchWord) {
      return;
    } else {
      //first clear out all entries in the filteredList array
      self.filteredList([]);
      //Loop through the meetups array and see if the search keyword matches
      //with any meetup name in the list, if so push that object to the filteredList
      //array and place the marker on the map.
      for (var i = 0; i < array.length; i++) {
        if (array[i].mName.toLowerCase().indexOf(searchWord) != -1) {
          self.mapMarkers()[i].marker.setMap(map);
          self.filteredList.push(array[i]);
        } else {
          self.mapMarkers()[i].marker.setMap(null);
        }
      }
      self.meetupStatus(self.numMeetups() + ' meetup found nearby.');
    }
  };

  mapInitialize();
}

ko.applyBindings(new appViewModel());
