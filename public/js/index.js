renderjson.set_show_to_level("all");

(function () {
  document.getElementById("json").appendChild(
    renderjson({
      "error": false,
      "msg": "lagos with population",
      "data": {
        "city": "Lagos",
        "country": "Nigeria",
        "populationCounts": [
          {
            "year": "1991",
            "value": "5195247",
            "sex": "Both Sexes",
            "reliabilty": "Final figure, complete"
          }
        ]
      }
    })
  );
})()
