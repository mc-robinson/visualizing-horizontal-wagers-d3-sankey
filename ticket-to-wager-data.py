"""
Makes amwager ticket ready for visualization 
using the Sankey diagriams developed by Robin Howlett.
The source code for his visualizations can be found at
https://github.com/robinhowlett/visualizing-horizontal-wagers-d3-sankey

Usage: python ticket-to-wager-data.py amwager_ticket_file.csv

@author: Matt Robinson, matthew67robinson@gmail.com 
"""

import sys
import call_NYRA_API

ticket_csv_filename = sys.argv[1]
#ticket_csv_filename = '../wagercalcNN/STD2_betsNN_PK5_20180822_file.csv'

with open(ticket_csv_filename,'r') as ticket_file:
    ticket_data = ticket_file.readlines()

# this might be a error prone way to get race number
#print(ticket_data[0])
first_race_number = int(ticket_data[0].split(',')[-4]) # change this

individual_tickets_list = [] # this will be a list of lists
for line in ticket_data:
    fields_list = line.split(',')
    for field in fields_list:
        if '/' in field:
            legs_pns_list = field.strip('"').split('/')
            individual_tickets_list.append(legs_pns_list)

unique_runners_dict = dict.fromkeys(range(first_race_number,len(individual_tickets_list[0])+first_race_number),[])
json_flow_strings_list = []
json_node_strings_list = []

i = first_race_number # makes for less typing                                
for ticket in individual_tickets_list:

    for key, runner in enumerate(ticket,i):
        old_runners_list = unique_runners_dict[key]
        if runner not in old_runners_list:
            new_runners_list = old_runners_list + [runner]
            unique_runners_dict[key] = new_runners_list
            
    flow_string = f"{{\"thru\": [\"R{i}#{ticket[0]}\",\"R{i+1}#{ticket[1]}\",\"R{i+2}#{ticket[2]}\",\"R{i+3}#{ticket[3]}\",\"R{i+4}#{ticket[4]}\"],\"value\": 1}},"
    json_flow_strings_list.append(flow_string)
    
for race in unique_runners_dict:
    for pn in unique_runners_dict[race]:
        
        node_string = f"{{\"disp\":\"#{pn}\", \"name\":\"R{race}#{pn}\"}},"
        json_node_strings_list.append(node_string)
        
final_file_string = \
'''
{
  "nodes": [
'''
    
for idx, node_string in enumerate(json_node_strings_list,1):
    
    if idx == len(json_node_strings_list):
        node_string = node_string.strip(',')
        final_file_string += node_string
    else:
        final_file_string += node_string + '\n'

final_file_string += \
'''
  ],
  "flows": [
'''

for idx, flow_string in enumerate(json_flow_strings_list,1):
    
    if idx == len(json_flow_strings_list):
        flow_string = flow_string.strip(',')
        final_file_string += flow_string
    else:
        final_file_string += flow_string + '\n'
    
final_file_string += \
'''
    ]
}
'''

last_race = first_race_number
race_winners_dict = dict.fromkeys(range(first_race_number,len(individual_tickets_list[0])+first_race_number),0)
for rn in race_winners_dict:
    race_dict = call_NYRA_API.getRaceDict(rn,'SAR') #need to make so not just Saratoga
    race_status = race_dict['raceStatus']
    if race_status == 5 and race_winners_dict[rn] == 0:
        last_race = rn
        for runner_dict in race_dict['runners']:
            if 'finishPosition' in runner_dict:
                if int(runner_dict['finishPosition']) == 1:
                    race_winners_dict[rn] = int(runner_dict['programNumber'])  
                    
winners_list = []
for race in race_winners_dict:
    winning_pn = race_winners_dict[race]
    if winning_pn != 0:
        winners_list.append(winning_pn)
    else:
        winners_list.append('')


alive_tickets_count=0   
next_race_alive_tickets=[]   
alive = False
for ticket in individual_tickets_list:
    winners_list_to_check = [str(x) for x in winners_list[0:(last_race-first_race_number+1)]]
    if winners_list_to_check == ticket[0:(last_race-first_race_number+1)]:
        alive = True
        alive_tickets_count += 1
        next_race_alive_tickets.append(int(ticket[(last_race-first_race_number+1)]))

if alive:
    status_str = f"ALIVE to {alive_tickets_count} tickets. Alive to {next_race_alive_tickets} in next race."
else:
    status_str = "BUST"
    
html_results_str = f'''
<p style="text-align:center;margin-top:10px;margin-bottom:10px"><b>RESULTS:</b> {status_str} </p>
<p style="text-align:center;margin-top:10px;margin-bottom:10px">1st race: <b>{winners_list[0]}</b> </p>
<p style="text-align:center;margin-top:10px;margin-bottom:10px">2nd race: <b>{winners_list[1]}</b> </p>
<p style="text-align:center;margin-top:10px;margin-bottom:10px">3rd race: <b>{winners_list[2]}</b> </p>
<p style="text-align:center;margin-top:10px;margin-bottom:10px">4th race: <b>{winners_list[3]}</b> </p>
<p style="text-align:center;margin-top:10px;margin-bottom:10px">5th race: <b>{winners_list[4]}</b> </p>
'''     
        
with open("./asset/wager-data.json","w") as f:
    f.write(final_file_string)

with open("./index.html",'r') as f:
    html_data = f.readlines()

num_tickets = len(individual_tickets_list)
total_price = num_tickets*0.5

for idx,line in enumerate(html_data):
    if "PK5 Visualization" in line:
        html_data[idx] = f"<p style=\"text-align:center;margin-top:10px;margin-bottom:10px\">PK5 Visualization. {num_tickets} TIX. ${total_price} </p>"
    if 'RESULTS' in line:
        html_data[idx:idx+6] = html_results_str

with open("./index.html",'w') as f:
    f.writelines(html_data)