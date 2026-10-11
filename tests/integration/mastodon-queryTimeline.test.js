let query = require('../../mastodon-queryTimeline');

test('tests queryTimeline returns results', async () => {
    let result = await query.queryTimeline();
    expect(result.length).toBeGreaterThan(0);

    for(let status of result){
        if(status){
            console.log(status);
        }
    }
});